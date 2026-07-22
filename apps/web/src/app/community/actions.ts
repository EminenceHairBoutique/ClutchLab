"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authMode, requireUser } from "@/lib/auth/gateway";
import { getMockAuthStore } from "@/lib/auth/mock-store";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import { checkContentRisk } from "@/lib/community/risk-flags";
import { getCommunityStore } from "@/lib/data/community-store";
import { notify } from "@/lib/notifications/notify";

export interface CommunityFormState {
  error: string | null;
  ok: boolean;
  flagged?: boolean;
}

async function authorLabelFor(userId: string): Promise<string> {
  if (authMode() !== "supabase") {
    return getMockAuthStore().authorLabel(userId);
  }
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("display_name, handle")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name ?? data?.handle ?? "player";
}

const postSchema = z.object({
  kind: z.enum([
    "discussion", "question", "settings", "layout", "drill_result",
    "meta_debate", "squad_recruitment",
  ]),
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().min(1).max(8000),
});

export async function createPostAction(
  _prev: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
  const user = await requireUser();
  const parsed = postSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid post.", ok: false };
  }

  const risk = checkContentRisk(`${parsed.data.title}\n${parsed.data.body}`);
  const label = await authorLabelFor(user.id);
  const result = await getCommunityStore().createPost(
    user.id,
    label,
    parsed.data.kind,
    parsed.data.title,
    parsed.data.body,
    risk,
  );
  if (!result.ok) return { error: result.error, ok: false };
  revalidatePath("/community");
  if (result.data.flagged) {
    return { error: null, ok: true, flagged: true };
  }
  redirect(`/community/${result.data.postId}`);
}

export async function addCommentAction(
  _prev: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
  const user = await requireUser();
  const postId = z.string().min(1).parse(formData.get("postId"));
  const body = z.string().trim().min(1).max(4000).safeParse(formData.get("body"));
  if (!body.success) return { error: "Comments must be 1–4000 characters.", ok: false };

  const label = await authorLabelFor(user.id);
  const store = getCommunityStore();
  const result = await store.addComment(postId, user.id, label, body.data);
  if (!result.ok) return { error: result.error, ok: false };

  const author = await store.getPostAuthor(postId);
  if (author && author !== user.id) {
    await notify(author, "community_reply", {
      title: "New reply on your post",
      body: `${label} commented: ${body.data.slice(0, 120)}`,
      path: `/community/${postId}`,
    });
  }
  revalidatePath(`/community/${postId}`);
  return { error: null, ok: true };
}

export async function toggleReactionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const postId = z.string().min(1).parse(formData.get("postId"));
  const kind = z.enum(["like", "insightful", "tested_it"]).parse(formData.get("kind"));
  const result = await getCommunityStore().toggleReaction(postId, user.id, kind);
  if (!result.ok) throw new Error(result.error);
  revalidatePath(`/community/${postId}`);
}

export async function submitReportAction(
  _prev: CommunityFormState,
  formData: FormData,
): Promise<CommunityFormState> {
  const user = await requireUser();
  const entityType = z.enum(["post", "comment", "pro_profile"]).parse(formData.get("entityType"));
  const entityId = z.string().min(1).parse(formData.get("entityId"));
  const reason = z
    .enum([
      "cheating_content", "macro_or_script", "account_trading", "uc_scam",
      "credential_request", "harassment", "false_verification", "copyright", "spam", "other",
    ])
    .parse(formData.get("reason"));
  const detail = z.string().max(1000).parse(formData.get("detail") ?? "").trim() || null;

  const result = await getCommunityStore().submitReport(user.id, entityType, entityId, reason, detail);
  if (!result.ok) return { error: result.error, ok: false };
  return { error: null, ok: true };
}
