import "server-only";

import type { Enums } from "@clutchlab/types";

import { authMode } from "@/lib/auth/gateway";
import { getMockAuthStore } from "@/lib/auth/mock-store";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import type { RiskCheck } from "@/lib/community/risk-flags";

export interface PostSummary {
  id: string;
  authorLabel: string;
  kind: Enums<"post_kind">;
  title: string;
  status: Enums<"content_status">;
  autoFlagReason: string | null;
  createdAt: string;
  isOwn: boolean;
}

export interface PostDetail extends PostSummary {
  body: string;
  comments: Array<{ id: string; authorLabel: string; body: string; createdAt: string }>;
  reactions: Record<string, number>;
}

export type CommunityResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface CommunityStore {
  listPosts(viewerId: string | null): Promise<PostSummary[]>;
  getPost(postId: string, viewerId: string | null): Promise<PostDetail | null>;
  createPost(
    userId: string,
    authorLabel: string,
    kind: Enums<"post_kind">,
    title: string,
    body: string,
    risk: RiskCheck,
  ): Promise<CommunityResult<{ postId: string; flagged: boolean }>>;
  addComment(
    postId: string,
    userId: string,
    authorLabel: string,
    body: string,
  ): Promise<CommunityResult<null>>;
  toggleReaction(postId: string, userId: string, kind: string): Promise<CommunityResult<null>>;
  submitReport(
    reporterId: string,
    entityType: "post" | "comment" | "pro_profile",
    entityId: string,
    reason: Enums<"report_reason">,
    detail: string | null,
  ): Promise<CommunityResult<null>>;
}

class MockCommunityStore implements CommunityStore {
  async listPosts(viewerId: string | null): Promise<PostSummary[]> {
    return getMockAuthStore()
      .listPosts(viewerId)
      .map((post) => ({
        id: post.id,
        authorLabel: post.authorLabel,
        kind: post.kind as Enums<"post_kind">,
        title: post.title,
        status: post.status,
        autoFlagReason: post.autoFlagReason,
        createdAt: post.createdAt,
        isOwn: post.authorId === viewerId,
      }));
  }

  async getPost(postId: string, viewerId: string | null): Promise<PostDetail | null> {
    const store = getMockAuthStore();
    const post = store.getPost(postId, viewerId);
    if (!post) return null;
    return {
      id: post.id,
      authorLabel: post.authorLabel,
      kind: post.kind as Enums<"post_kind">,
      title: post.title,
      status: post.status,
      autoFlagReason: post.autoFlagReason,
      createdAt: post.createdAt,
      isOwn: post.authorId === viewerId,
      body: post.body,
      comments: store.listComments(postId).map((c) => ({
        id: c.id,
        authorLabel: c.authorLabel,
        body: c.body,
        createdAt: c.createdAt,
      })),
      reactions: store.reactionCounts(postId),
    };
  }

  async createPost(
    userId: string,
    _authorLabel: string,
    kind: Enums<"post_kind">,
    title: string,
    body: string,
    risk: RiskCheck,
  ): Promise<CommunityResult<{ postId: string; flagged: boolean }>> {
    const post = getMockAuthStore().createPost(userId, kind, title, body, risk);
    return { ok: true, data: { postId: post.id, flagged: post.status === "flagged" } };
  }

  async addComment(
    postId: string,
    userId: string,
    _authorLabel: string,
    body: string,
  ): Promise<CommunityResult<null>> {
    getMockAuthStore().addComment(postId, userId, body);
    return { ok: true, data: null };
  }

  async toggleReaction(postId: string, userId: string, kind: string): Promise<CommunityResult<null>> {
    getMockAuthStore().toggleReaction(postId, userId, kind);
    return { ok: true, data: null };
  }

  async submitReport(
    reporterId: string,
    entityType: "post" | "comment" | "pro_profile",
    entityId: string,
    reason: Enums<"report_reason">,
    detail: string | null,
  ): Promise<CommunityResult<null>> {
    getMockAuthStore().addCommunityReport(reporterId, entityType, entityId, reason, detail);
    return { ok: true, data: null };
  }
}

class SupabaseCommunityStore implements CommunityStore {
  async listPosts(viewerId: string | null): Promise<PostSummary[]> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("posts")
      .select("id, author_id, author_label, kind, title, status, auto_flag_reason, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(`posts read failed: ${error.message}`);
    return data.map((post) => ({
      id: post.id,
      authorLabel: post.author_label,
      kind: post.kind,
      title: post.title,
      status: post.status,
      autoFlagReason: post.auto_flag_reason,
      createdAt: post.created_at,
      isOwn: post.author_id === viewerId,
    }));
  }

  async getPost(postId: string, viewerId: string | null): Promise<PostDetail | null> {
    const supabase = await createServerSupabase();
    const { data: post, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .maybeSingle();
    if (error) throw new Error(`post read failed: ${error.message}`);
    if (!post) return null;
    const [commentsRes, reactionsRes] = await Promise.all([
      supabase
        .from("comments")
        .select("id, author_label, body, created_at")
        .eq("post_id", postId)
        .order("created_at"),
      supabase.from("reactions").select("kind").eq("post_id", postId),
    ]);
    if (commentsRes.error) throw new Error(`comments read failed: ${commentsRes.error.message}`);
    if (reactionsRes.error) throw new Error(`reactions read failed: ${reactionsRes.error.message}`);
    const reactions: Record<string, number> = {};
    for (const reaction of reactionsRes.data) {
      reactions[reaction.kind] = (reactions[reaction.kind] ?? 0) + 1;
    }
    return {
      id: post.id,
      authorLabel: post.author_label,
      kind: post.kind,
      title: post.title,
      status: post.status,
      autoFlagReason: post.auto_flag_reason,
      createdAt: post.created_at,
      isOwn: post.author_id === viewerId,
      body: post.body,
      comments: commentsRes.data.map((c) => ({
        id: c.id,
        authorLabel: c.author_label,
        body: c.body,
        createdAt: c.created_at,
      })),
      reactions,
    };
  }

  async createPost(
    userId: string,
    authorLabel: string,
    kind: Enums<"post_kind">,
    title: string,
    body: string,
    risk: RiskCheck,
  ): Promise<CommunityResult<{ postId: string; flagged: boolean }>> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("posts")
      .insert({
        author_id: userId,
        author_label: authorLabel,
        kind,
        title,
        body,
        status: risk.flagged ? "flagged" : "visible",
        auto_flag_reason: risk.reason,
      })
      .select("id, status")
      .single();
    if (error) return { ok: false, error: `Could not post: ${error.message}` };
    return { ok: true, data: { postId: data.id, flagged: data.status === "flagged" } };
  }

  async addComment(
    postId: string,
    userId: string,
    authorLabel: string,
    body: string,
  ): Promise<CommunityResult<null>> {
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("comments")
      .insert({ post_id: postId, author_id: userId, author_label: authorLabel, body });
    if (error) return { ok: false, error: `Could not comment: ${error.message}` };
    return { ok: true, data: null };
  }

  async toggleReaction(postId: string, userId: string, kind: string): Promise<CommunityResult<null>> {
    const supabase = await createServerSupabase();
    const { data: existing, error } = await supabase
      .from("reactions")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .eq("kind", kind)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (existing) {
      const { error: deleteError } = await supabase.from("reactions").delete().eq("id", existing.id);
      if (deleteError) return { ok: false, error: deleteError.message };
    } else {
      const { error: insertError } = await supabase
        .from("reactions")
        .insert({ post_id: postId, user_id: userId, kind });
      if (insertError) return { ok: false, error: insertError.message };
    }
    return { ok: true, data: null };
  }

  async submitReport(
    reporterId: string,
    entityType: "post" | "comment" | "pro_profile",
    entityId: string,
    reason: Enums<"report_reason">,
    detail: string | null,
  ): Promise<CommunityResult<null>> {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("reports").insert({
      reporter_id: reporterId,
      entity_type: entityType,
      entity_id: entityId,
      reason,
      detail,
    });
    if (error) return { ok: false, error: `Could not report: ${error.message}` };
    return { ok: true, data: null };
  }
}

export function getCommunityStore(): CommunityStore {
  return authMode() === "supabase" ? new SupabaseCommunityStore() : new MockCommunityStore();
}
