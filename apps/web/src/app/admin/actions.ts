"use server";

import type { Json } from "@clutchlab/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authMode, requireUser } from "@/lib/auth/gateway";
import { checkRoleAtLeast } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/auth/supabase-server";

export interface AdminFormState {
  error: string | null;
  ok: boolean;
}

/**
 * Editor-gated mutations. The database RLS policies are the real enforcement —
 * these actions run under the caller's session, so a non-editor bypassing the
 * UI still gets a 42501 from Postgres.
 */
async function requireEditor() {
  const user = await requireUser();
  if (authMode() !== "supabase") {
    redirect("/admin");
  }
  const allowed = await checkRoleAtLeast(user, "editor");
  if (!allowed) redirect("/admin");
  return user;
}

async function recordRevision(
  actorId: string,
  entityType: string,
  entityId: string,
  action: string,
  diff: Json,
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("content_revisions").insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    diff,
    actor_id: actorId,
  });
  if (error) {
    // Never fail the user action because audit logging failed; surface loudly instead.
    console.error(`content_revisions insert failed: ${error.message}`);
  }
}

const versionSchema = z.object({
  version: z.string().trim().regex(/^\d+\.\d+(\.\d+)?$/, "Version must look like 4.5 or 4.5.1"),
  editionSlug: z.string().trim().min(2),
  releasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  headline: z.string().trim().min(1).max(300).nullable(),
  sourceName: z.string().trim().min(3, "A source is required for time-sensitive records."),
  sourceUrl: z.string().trim().url("Source URL must be a valid URL.").nullable(),
});

export async function createVersionAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const user = await requireEditor();
  const raw = (key: string) => {
    const value = formData.get(key);
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };

  const parsed = versionSchema.safeParse({
    version: raw("version") ?? "",
    editionSlug: raw("editionSlug") ?? "global",
    releasedOn: raw("releasedOn"),
    headline: raw("headline"),
    sourceName: raw("sourceName") ?? "",
    sourceUrl: raw("sourceUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input.", ok: false };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("game_versions")
    .insert({
      version: parsed.data.version,
      edition_slug: parsed.data.editionSlug,
      released_on: parsed.data.releasedOn,
      headline: parsed.data.headline,
      data_status: "unverified",
      confidence: "unverified",
      source_name: parsed.data.sourceName,
      source_url: parsed.data.sourceUrl,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return { error: "That version already exists for this edition.", ok: false };
    return { error: `Insert failed: ${error.message}`, ok: false };
  }

  await recordRevision(user.id, "game_version", data?.id ?? parsed.data.version, "create", {
    version: parsed.data.version,
    edition: parsed.data.editionSlug,
  });
  revalidatePath("/admin/versions");
  return { error: null, ok: true };
}

const reviewStatusSchema = z.enum(["open", "in_progress", "done", "dismissed"]);

export async function updateReviewTaskAction(formData: FormData): Promise<void> {
  const user = await requireEditor();
  const id = z.string().uuid().parse(formData.get("taskId"));
  const status = reviewStatusSchema.parse(formData.get("status"));

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("review_tasks")
    .update({
      status,
      resolved_by: status === "done" || status === "dismissed" ? user.id : null,
      resolved_at: status === "done" || status === "dismissed" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(`review_tasks update failed: ${error.message}`);

  await recordRevision(user.id, "review_task", id, `status:${status}`, {});
  revalidatePath("/admin/review");
}

const snapshotActionSchema = z.object({
  snapshotId: z.string().uuid(),
  nextStatus: z.enum(["published", "archived", "draft"]),
});

export async function setSnapshotStatusAction(formData: FormData): Promise<void> {
  const user = await requireEditor();
  const parsed = snapshotActionSchema.parse({
    snapshotId: formData.get("snapshotId"),
    nextStatus: formData.get("nextStatus"),
  });

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("meta_snapshots")
    .update({
      status: parsed.nextStatus,
      published_at: parsed.nextStatus === "published" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.snapshotId);
  if (error) throw new Error(`meta_snapshots update failed: ${error.message}`);

  await recordRevision(user.id, "meta_snapshot", parsed.snapshotId, `status:${parsed.nextStatus}`, {});
  revalidatePath("/admin/snapshots");
  revalidatePath("/meta");
}
