"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/gateway";
import { checkRoleAtLeast } from "@/lib/auth/roles";
import { getCoachStore } from "@/lib/data/coach-store";

/** Human-review tools (spec §5.13.7): editors spot-check AI reports. */
export async function reviewReportAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const allowed = await checkRoleAtLeast(user, "editor");
  if (!allowed) throw new Error("editor role required");

  const reportId = z.string().uuid().parse(formData.get("reportId"));
  const decision = z.enum(["published", "rejected"]).parse(formData.get("decision"));
  const ok = await getCoachStore().reviewReport(user.id, reportId, decision);
  if (!ok) throw new Error("report not found or already reviewed");
  revalidatePath("/admin/coach");
}
