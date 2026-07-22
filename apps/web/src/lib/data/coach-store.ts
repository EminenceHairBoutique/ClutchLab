import "server-only";

import {
  MockCoachProvider,
  UPLOAD_KIND_LABELS,
  currentQuotaWindowStart,
  mistakeSchema,
  quotaState,
  runAnalysis,
  type CoachContext,
  type Mistake,
  type QuotaState,
  type UploadKind,
} from "@clutchlab/coach";
import { DRILLS } from "@clutchlab/content";
import { z } from "zod";

import { authMode } from "@/lib/auth/gateway";
import { getMockAuthStore } from "@/lib/auth/mock-store";
import { createServerSupabase } from "@/lib/auth/supabase-server";

/**
 * Coach data store. Mock mode is a fully self-contained demo: the in-memory
 * store simulates the background worker in-process using the REAL pipeline
 * with the mock provider (instant, no video, clearly labeled). Supabase mode
 * never processes in a request handler — jobs queue for the worker
 * (`pnpm --filter @clutchlab/coach worker`), per the background-job hard rule.
 */

export interface UploadView {
  id: string;
  kind: UploadKind;
  kindLabel: string;
  label: string;
  durationSeconds: number | null;
  status: string;
  createdAt: string;
  job: { id: string; status: string; attempts: number; error: string | null } | null;
  reportId: string | null;
}

export interface ObservationView {
  tSeconds: number;
  category: string;
  observation: string;
  inference: boolean;
  confidence: string;
}

export interface ReportView {
  id: string;
  jobId: string;
  uploadLabel: string | null;
  uploadKindLabel: string | null;
  executiveSummary: string;
  mistakes: Mistake[];
  settingsNote: string | null;
  couldNotDetermine: string;
  confidence: string;
  modelId: string;
  promptVersion: string;
  reviewStatus: string;
  createdAt: string;
  observations: ObservationView[];
  recommendations: Array<{ drillSlug: string; drillName: string; reason: string }>;
  isOwn: boolean;
}

export interface ReviewQueueItem {
  id: string;
  executiveSummary: string;
  modelId: string;
  promptVersion: string;
  confidence: string;
  mistakesCount: number;
  createdAt: string;
}

export type CoachResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface CoachStore {
  quota(userId: string): Promise<QuotaState>;
  registerUpload(
    userId: string,
    input: { kind: UploadKind; label: string; durationSeconds: number | null },
  ): Promise<CoachResult<{ uploadId: string }>>;
  /** Marks storage upload complete. Mock: simulated; Supabase: after signed-URL upload. */
  markUploaded(userId: string, uploadId: string): Promise<CoachResult<null>>;
  requestAnalysis(userId: string, uploadId: string): Promise<CoachResult<{ jobId: string }>>;
  listUploads(userId: string): Promise<UploadView[]>;
  deleteUpload(userId: string, uploadId: string): Promise<boolean>;
  getReport(
    viewer: { userId: string; isEditor: boolean },
    reportId: string,
  ): Promise<ReportView | null>;
  /** Callers must gate on the editor role before invoking. */
  listPendingReview(): Promise<ReviewQueueItem[]>;
  reviewReport(
    editorId: string,
    reportId: string,
    decision: "published" | "rejected",
  ): Promise<boolean>;
}

const drillNameBySlug = new Map(DRILLS.map((d) => [d.slug, d.name]));
const mistakesColumnSchema = z.array(mistakeSchema);

function parseMistakes(reportId: string, raw: unknown): Mistake[] {
  const parsed = mistakesColumnSchema.safeParse(raw);
  if (!parsed.success) {
    // The worker validates before writing, so this is a data-integrity bug —
    // surface it instead of rendering a silently incomplete report.
    throw new Error(`coaching report ${reportId} has a corrupted mistakes payload`);
  }
  return parsed.data;
}

class MockCoachStore implements CoachStore {
  async quota(userId: string): Promise<QuotaState> {
    const windowStart = currentQuotaWindowStart().toISOString();
    return quotaState(getMockAuthStore().countJobsSince(userId, windowStart));
  }

  async registerUpload(
    userId: string,
    input: { kind: UploadKind; label: string; durationSeconds: number | null },
  ): Promise<CoachResult<{ uploadId: string }>> {
    const uploadId = getMockAuthStore().registerUpload(userId, input);
    return { ok: true, data: { uploadId } };
  }

  async markUploaded(userId: string, uploadId: string): Promise<CoachResult<null>> {
    const store = getMockAuthStore();
    const upload = store.getUpload(userId, uploadId);
    if (!upload) return { ok: false, error: "Upload not found." };
    if (upload.status !== "registered") {
      return { ok: false, error: "This upload already has its recording attached." };
    }
    store.setUploadStatus(uploadId, "uploaded");
    return { ok: true, data: null };
  }

  async requestAnalysis(userId: string, uploadId: string): Promise<CoachResult<{ jobId: string }>> {
    const store = getMockAuthStore();
    const upload = store.getUpload(userId, uploadId);
    if (!upload) return { ok: false, error: "Upload not found." };
    if (upload.status !== "uploaded") {
      return { ok: false, error: "Attach the recording before requesting analysis." };
    }
    const quota = await this.quota(userId);
    if (quota.remaining <= 0) {
      return { ok: false, error: `Monthly analysis limit reached (${quota.limit}).` };
    }

    const { jobId, created } = store.createAnalysisJob(userId, uploadId);
    if (!created) return { ok: true, data: { jobId } };

    // Simulated background worker (mock mode only): the real pipeline with the
    // mock provider — instant and deterministic, so no request-handler video
    // processing happens here. Supabase mode queues for the real worker.
    const context: CoachContext = {
      uploadKind: upload.kind as UploadKind,
      label: upload.label,
      durationSeconds: upload.durationSeconds,
      frames: [],
    };
    try {
      const result = await runAnalysis(new MockCoachProvider(), context);
      store.completeAnalysisJob(jobId, {
        observations: result.observations,
        report: {
          executiveSummary: result.draft.executiveSummary,
          mistakes: result.draft.mistakes,
          settingsNote: result.draft.settingsNote,
          couldNotDetermine: result.draft.couldNotDetermine,
          confidence: result.draft.confidence,
          modelId: result.modelId,
          promptVersion: result.promptVersion,
        },
        recommendations: result.draft.drillSlugs.map((slug) => ({
          drillSlug: slug,
          reason: "Assigned from the mistakes identified in this analysis.",
        })),
      });
    } catch (error) {
      store.failAnalysisJob(jobId, error instanceof Error ? error.message : String(error));
    }
    return { ok: true, data: { jobId } };
  }

  async listUploads(userId: string): Promise<UploadView[]> {
    const store = getMockAuthStore();
    return store.listUploads(userId).map((upload) => {
      const job = store.getJobForUpload(upload.id);
      const report = job ? store.getCoachReportForJob(job.id) : null;
      return {
        id: upload.id,
        kind: upload.kind as UploadKind,
        kindLabel: UPLOAD_KIND_LABELS[upload.kind as UploadKind] ?? upload.kind,
        label: upload.label,
        durationSeconds: upload.durationSeconds,
        status: upload.status,
        createdAt: upload.createdAt,
        job: job
          ? { id: job.id, status: job.status, attempts: job.attempts, error: job.error }
          : null,
        reportId: report?.id ?? null,
      };
    });
  }

  async deleteUpload(userId: string, uploadId: string): Promise<boolean> {
    return getMockAuthStore().deleteUpload(userId, uploadId);
  }

  async getReport(
    viewer: { userId: string; isEditor: boolean },
    reportId: string,
  ): Promise<ReportView | null> {
    const store = getMockAuthStore();
    const report = store.getCoachReport(reportId);
    if (!report) return null;
    const isOwn = report.userId === viewer.userId;
    if (!isOwn && !viewer.isEditor) return null;
    const job = [...store.listUploads(report.userId)]
      .map((u) => ({ upload: u, job: store.getJobForUpload(u.id) }))
      .find((pair) => pair.job?.id === report.jobId);
    return {
      id: report.id,
      jobId: report.jobId,
      uploadLabel: isOwn ? (job?.upload.label ?? null) : null,
      uploadKindLabel: isOwn
        ? (UPLOAD_KIND_LABELS[job?.upload.kind as UploadKind] ?? job?.upload.kind ?? null)
        : null,
      executiveSummary: report.executiveSummary,
      mistakes: report.mistakes,
      settingsNote: report.settingsNote,
      couldNotDetermine: report.couldNotDetermine,
      confidence: report.confidence,
      modelId: report.modelId,
      promptVersion: report.promptVersion,
      reviewStatus: report.reviewStatus,
      createdAt: report.createdAt,
      observations: store.listObservations(report.jobId),
      recommendations: store.listRecommendations(report.id).map((r) => ({
        drillSlug: r.drillSlug,
        drillName: drillNameBySlug.get(r.drillSlug) ?? r.drillSlug,
        reason: r.reason,
      })),
      isOwn,
    };
  }

  async listPendingReview(): Promise<ReviewQueueItem[]> {
    return getMockAuthStore()
      .listReportsPendingReview()
      .map((r) => ({
        id: r.id,
        executiveSummary: r.executiveSummary,
        modelId: r.modelId,
        promptVersion: r.promptVersion,
        confidence: r.confidence,
        mistakesCount: r.mistakes.length,
        createdAt: r.createdAt,
      }));
  }

  async reviewReport(
    editorId: string,
    reportId: string,
    decision: "published" | "rejected",
  ): Promise<boolean> {
    return getMockAuthStore().reviewCoachReport(editorId, reportId, decision);
  }
}

class SupabaseCoachStore implements CoachStore {
  async quota(_userId: string): Promise<QuotaState> {
    const supabase = await createServerSupabase();
    const windowStart = currentQuotaWindowStart().toISOString();
    // RLS scopes the count to the caller's own jobs.
    const { count, error } = await supabase
      .from("analysis_jobs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", windowStart);
    if (error) throw new Error(`quota read failed: ${error.message}`);
    return quotaState(count ?? 0);
  }

  async registerUpload(
    userId: string,
    input: { kind: UploadKind; label: string; durationSeconds: number | null },
  ): Promise<CoachResult<{ uploadId: string }>> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("video_uploads")
      .insert({
        user_id: userId,
        kind: input.kind,
        label: input.label,
        duration_seconds: input.durationSeconds,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { uploadId: data.id } };
  }

  /**
   * Production upload path (spec §5.13.1): the client PUTs the recording to
   * Supabase Storage via a signed URL, then this marks the row uploaded.
   * Requires the `recordings` bucket — see AI_COACH.md.
   */
  async createSignedUploadUrl(
    userId: string,
    uploadId: string,
  ): Promise<CoachResult<{ path: string; token: string }>> {
    const supabase = await createServerSupabase();
    const path = `${userId}/${uploadId}.mp4`;
    const { data, error } = await supabase.storage
      .from("recordings")
      .createSignedUploadUrl(path);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { path: data.path, token: data.token } };
  }

  async markUploaded(_userId: string, uploadId: string): Promise<CoachResult<null>> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("video_uploads")
      .update({ status: "uploaded" })
      .eq("id", uploadId)
      .eq("status", "registered")
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (data.length === 0) return { ok: false, error: "Upload not found or already attached." };
    return { ok: true, data: null };
  }

  async requestAnalysis(userId: string, uploadId: string): Promise<CoachResult<{ jobId: string }>> {
    const supabase = await createServerSupabase();
    const { data: upload, error: uploadError } = await supabase
      .from("video_uploads")
      .select("id, status")
      .eq("id", uploadId)
      .maybeSingle();
    if (uploadError) return { ok: false, error: uploadError.message };
    if (!upload) return { ok: false, error: "Upload not found." };
    if (upload.status !== "uploaded") {
      return { ok: false, error: "Attach the recording before requesting analysis." };
    }
    const quota = await this.quota(userId);
    if (quota.remaining <= 0) {
      return { ok: false, error: `Monthly analysis limit reached (${quota.limit}).` };
    }

    // Idempotent queueing: unique(upload_id) makes re-requests return the
    // existing job instead of creating a second one.
    const { data: job, error } = await supabase
      .from("analysis_jobs")
      .insert({ upload_id: uploadId, user_id: userId, idempotency_key: `analyze:${uploadId}` })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await supabase
          .from("analysis_jobs")
          .select("id")
          .eq("upload_id", uploadId)
          .maybeSingle();
        if (existing) return { ok: true, data: { jobId: existing.id } };
      }
      return { ok: false, error: error.message };
    }
    await supabase
      .from("video_uploads")
      .update({ status: "queued" })
      .eq("id", uploadId);
    // Processing happens in the background worker, never here.
    return { ok: true, data: { jobId: job.id } };
  }

  async listUploads(_userId: string): Promise<UploadView[]> {
    const supabase = await createServerSupabase();
    const { data: uploads, error } = await supabase
      .from("video_uploads")
      .select("id, kind, label, duration_seconds, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`uploads read failed: ${error.message}`);
    const { data: jobs, error: jobsError } = await supabase
      .from("analysis_jobs")
      .select("id, upload_id, status, attempts, error");
    if (jobsError) throw new Error(`jobs read failed: ${jobsError.message}`);
    const { data: reports, error: reportsError } = await supabase
      .from("coaching_reports")
      .select("id, job_id");
    if (reportsError) throw new Error(`reports read failed: ${reportsError.message}`);
    const jobByUpload = new Map(jobs.map((j) => [j.upload_id, j]));
    const reportByJob = new Map(reports.map((r) => [r.job_id, r]));
    return uploads.map((u) => {
      const job = jobByUpload.get(u.id) ?? null;
      return {
        id: u.id,
        kind: u.kind,
        kindLabel: UPLOAD_KIND_LABELS[u.kind] ?? u.kind,
        label: u.label,
        durationSeconds: u.duration_seconds,
        status: u.status,
        createdAt: u.created_at,
        job: job
          ? { id: job.id, status: job.status, attempts: job.attempts, error: job.error }
          : null,
        reportId: job ? (reportByJob.get(job.id)?.id ?? null) : null,
      };
    });
  }

  async deleteUpload(_userId: string, uploadId: string): Promise<boolean> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("video_uploads")
      .delete()
      .eq("id", uploadId)
      .select("id");
    return !error && data.length > 0;
  }

  async getReport(
    viewer: { userId: string; isEditor: boolean },
    reportId: string,
  ): Promise<ReportView | null> {
    const supabase = await createServerSupabase();
    // RLS grants access to owners and editors; anyone else sees nothing.
    const { data: report, error } = await supabase
      .from("coaching_reports")
      .select(
        "id, job_id, user_id, executive_summary, mistakes, settings_note, could_not_determine, confidence, model_id, prompt_version, review_status, created_at",
      )
      .eq("id", reportId)
      .maybeSingle();
    if (error) throw new Error(`report read failed: ${error.message}`);
    if (!report) return null;
    const isOwn = report.user_id === viewer.userId;

    const { data: observations, error: obsError } = await supabase
      .from("video_observations")
      .select("t_seconds, category, observation, inference, confidence")
      .eq("job_id", report.job_id)
      .order("t_seconds");
    if (obsError) throw new Error(`observations read failed: ${obsError.message}`);

    const { data: recommendations, error: recError } = await supabase
      .from("coaching_recommendations")
      .select("drill_slug, reason")
      .eq("report_id", report.id);
    if (recError) throw new Error(`recommendations read failed: ${recError.message}`);

    // Upload metadata is owner-only by RLS; editors review the AI output.
    let uploadLabel: string | null = null;
    let uploadKindLabel: string | null = null;
    if (isOwn) {
      const { data: job } = await supabase
        .from("analysis_jobs")
        .select("upload_id")
        .eq("id", report.job_id)
        .maybeSingle();
      if (job) {
        const { data: upload } = await supabase
          .from("video_uploads")
          .select("label, kind")
          .eq("id", job.upload_id)
          .maybeSingle();
        uploadLabel = upload?.label ?? null;
        uploadKindLabel = upload ? (UPLOAD_KIND_LABELS[upload.kind] ?? upload.kind) : null;
      }
    }

    return {
      id: report.id,
      jobId: report.job_id,
      uploadLabel,
      uploadKindLabel,
      executiveSummary: report.executive_summary,
      mistakes: parseMistakes(report.id, report.mistakes),
      settingsNote: report.settings_note,
      couldNotDetermine: report.could_not_determine,
      confidence: report.confidence,
      modelId: report.model_id,
      promptVersion: report.prompt_version,
      reviewStatus: report.review_status,
      createdAt: report.created_at,
      observations: observations.map((o) => ({
        tSeconds: o.t_seconds,
        category: o.category,
        observation: o.observation,
        inference: o.inference,
        confidence: o.confidence,
      })),
      recommendations: recommendations.map((r) => ({
        drillSlug: r.drill_slug,
        drillName: drillNameBySlug.get(r.drill_slug) ?? r.drill_slug,
        reason: r.reason,
      })),
      isOwn,
    };
  }

  async listPendingReview(): Promise<ReviewQueueItem[]> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("coaching_reports")
      .select("id, executive_summary, model_id, prompt_version, confidence, mistakes, created_at")
      .eq("review_status", "pending_review")
      .order("created_at");
    if (error) throw new Error(`review queue read failed: ${error.message}`);
    return data.map((r) => ({
      id: r.id,
      executiveSummary: r.executive_summary,
      modelId: r.model_id,
      promptVersion: r.prompt_version,
      confidence: r.confidence,
      mistakesCount: parseMistakes(r.id, r.mistakes).length,
      createdAt: r.created_at,
    }));
  }

  async reviewReport(
    editorId: string,
    reportId: string,
    decision: "published" | "rejected",
  ): Promise<boolean> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("coaching_reports")
      .update({
        review_status: decision,
        reviewed_by: editorId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reportId)
      .eq("review_status", "pending_review")
      .select("id");
    return !error && data.length > 0;
  }
}

export function getCoachStore(): CoachStore {
  return authMode() === "supabase" ? new SupabaseCoachStore() : new MockCoachStore();
}
