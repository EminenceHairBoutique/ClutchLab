"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authMode, requireUser } from "@/lib/auth/gateway";
import { checkRoleAtLeast } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/auth/supabase-server";

/**
 * Moderator decisions on reports. RLS is the real enforcement — these run
 * under the moderator's own session. Every decision writes a moderation_actions
 * row (spec §5.16 audit requirement).
 */
export async function moderateReportAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (authMode() !== "supabase") redirect("/admin");
  const isModerator = await checkRoleAtLeast(user, "moderator");
  if (!isModerator) redirect("/admin");

  const reportId = z.string().uuid().parse(formData.get("reportId"));
  const decision = z.enum(["remove", "dismiss"]).parse(formData.get("decision"));

  const supabase = await createServerSupabase();
  const { data: report, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (error || !report) throw new Error(`report read failed: ${error?.message ?? "not found"}`);

  if (decision === "remove") {
    if (report.entity_type === "post") {
      const { error: updateError } = await supabase
        .from("posts")
        .update({ status: "removed" })
        .eq("id", report.entity_id);
      if (updateError) throw new Error(`post removal failed: ${updateError.message}`);
    } else if (report.entity_type === "comment") {
      const { error: updateError } = await supabase
        .from("comments")
        .update({ status: "removed" })
        .eq("id", report.entity_id);
      if (updateError) throw new Error(`comment removal failed: ${updateError.message}`);
    }
  }

  const { error: reportError } = await supabase
    .from("reports")
    .update({
      status: decision === "remove" ? "actioned" : "dismissed",
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  if (reportError) throw new Error(`report update failed: ${reportError.message}`);

  const { error: actionError } = await supabase.from("moderation_actions").insert({
    moderator_id: user.id,
    report_id: reportId,
    action: decision === "remove" ? "remove_content" : "dismiss_report",
    entity_type: report.entity_type,
    entity_id: report.entity_id,
    note: null,
  });
  if (actionError) {
    console.error(`moderation_actions insert failed: ${actionError.message}`);
  }

  revalidatePath("/admin/moderation");
  revalidatePath("/community");
}
