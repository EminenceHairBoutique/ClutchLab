import { randomUUID } from "node:crypto";

/**
 * In-memory identity + profile store backing the MOCK auth adapter.
 *
 * DEV/TEST ONLY. Passwords are kept in plain memory on purpose: this store
 * exists so the app is fully exercisable without Supabase credentials, and
 * production env validation refuses to boot in mock mode (see @clutchlab/config).
 * Everything here resets on server restart.
 */

export interface MockUser {
  id: string;
  email: string;
  password: string;
}

export interface MockProfileRecord {
  displayName: string | null;
  handle: string | null;
  region: string | null;
  fingerCount: number | null;
  gripStyle: string | null;
  gyroMode: string | null;
  aimAssistPref: string | null;
  primaryDeviceId: string | null;
}

export interface MockSensitivityVersion {
  id: string;
  versionNo: number;
  note: string | null;
  origin: string;
  createdAt: string;
  values: Record<string, number>;
}

export interface MockSensitivityProfile {
  id: string;
  userId: string;
  name: string;
  activeVersionId: string;
  versions: MockSensitivityVersion[];
}

export interface MockCode {
  id: string;
  userId: string;
  profileId: string | null;
  kind: string;
  code: string;
  label: string | null;
  createdAt: string;
}

export interface MockPost {
  id: string;
  authorId: string;
  authorLabel: string;
  kind: string;
  title: string;
  body: string;
  status: "visible" | "flagged" | "removed" | "retracted";
  autoFlagReason: string | null;
  createdAt: string;
}

export interface MockComment {
  id: string;
  postId: string;
  authorId: string;
  authorLabel: string;
  body: string;
  createdAt: string;
}

export interface MockReaction {
  id: string;
  postId: string;
  userId: string;
  kind: string;
}

export interface MockReport {
  id: string;
  reporterId: string;
  entityType: string;
  entityId: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
}

export interface MockControlPosition {
  slug: string;
  x: number;
  y: number;
  size: number;
}

export interface MockControlAnalysis {
  score: number;
  findings: Array<{ severity: string; text: string }>;
  workloads: Record<string, string[]>;
  engineVersion: string;
}

export interface MockControlVersion {
  id: string;
  versionNo: number;
  note: string | null;
  origin: string;
  createdAt: string;
  positions: MockControlPosition[];
  analysis: MockControlAnalysis;
}

export interface MockControlLayout {
  id: string;
  userId: string;
  name: string;
  fingerCount: number;
  activeVersionId: string;
  versions: MockControlVersion[];
}

export interface MockTrainingSession {
  id: string;
  userId: string;
  title: string;
  minutesPlanned: number;
  drillSlugs: string[];
  planSlug: string | null;
  status: "planned" | "in_progress" | "completed" | "abandoned";
  startedAt: string;
  completedAt: string | null;
  note: string | null;
}

export interface MockDrillResult {
  id: string;
  userId: string;
  sessionId: string | null;
  drillSlug: string;
  passed: boolean | null;
  selfRating: number | null;
  metricNote: string | null;
  createdAt: string;
}

export interface MockUpload {
  id: string;
  userId: string;
  kind: string;
  label: string;
  durationSeconds: number | null;
  status: "registered" | "uploaded" | "queued" | "processing" | "complete" | "failed";
  createdAt: string;
}

export interface MockAnalysisJob {
  id: string;
  uploadId: string;
  userId: string;
  idempotencyKey: string;
  status: "queued" | "running" | "succeeded" | "failed";
  attempts: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface MockCoachObservation {
  id: string;
  jobId: string;
  tSeconds: number;
  category: string;
  observation: string;
  inference: boolean;
  confidence: string;
}

export interface MockCoachReport {
  id: string;
  jobId: string;
  userId: string;
  executiveSummary: string;
  mistakes: Array<{ tSeconds: number; what: string; whyItMattered: string; betterAlternative: string }>;
  settingsNote: string | null;
  couldNotDetermine: string;
  confidence: string;
  modelId: string;
  promptVersion: string;
  reviewStatus: "pending_review" | "published" | "rejected";
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface MockCoachRecommendation {
  id: string;
  reportId: string;
  drillSlug: string;
  reason: string;
}

const emptyProfile = (): MockProfileRecord => ({
  displayName: null,
  handle: null,
  region: null,
  fingerCount: null,
  gripStyle: null,
  gyroMode: null,
  aimAssistPref: null,
  primaryDeviceId: null,
});

export class MockAuthStore {
  private usersByEmail = new Map<string, MockUser>();
  private usersById = new Map<string, MockUser>();
  private sessions = new Map<string, string>();
  private profiles = new Map<string, MockProfileRecord>();
  private roles = new Map<string, Set<string>>();

  createUser(email: string, password: string): { ok: true; user: MockUser } | { ok: false; error: string } {
    const normalized = email.trim().toLowerCase();
    if (this.usersByEmail.has(normalized)) {
      return { ok: false, error: "An account with this email already exists." };
    }
    const user: MockUser = { id: randomUUID(), email: normalized, password };
    this.usersByEmail.set(normalized, user);
    this.usersById.set(user.id, user);
    // Mirrors the real signup trigger creating an empty profile row.
    this.profiles.set(user.id, emptyProfile());
    return { ok: true, user };
  }

  verifyPassword(email: string, password: string): MockUser | null {
    const user = this.usersByEmail.get(email.trim().toLowerCase());
    if (!user || user.password !== password) return null;
    return user;
  }

  createSession(userId: string): string {
    const token = randomUUID();
    this.sessions.set(token, userId);
    return token;
  }

  getUserBySession(token: string | undefined): MockUser | null {
    if (!token) return null;
    const userId = this.sessions.get(token);
    if (!userId) return null;
    return this.usersById.get(userId) ?? null;
  }

  deleteSession(token: string | undefined): void {
    if (token) this.sessions.delete(token);
  }

  getProfile(userId: string): MockProfileRecord | null {
    return this.profiles.get(userId) ?? null;
  }

  updateProfile(
    userId: string,
    patch: Partial<MockProfileRecord>,
  ): { ok: true } | { ok: false; error: string } {
    const current = this.profiles.get(userId);
    if (!current) return { ok: false, error: "Profile not found." };
    if (patch.handle) {
      for (const [otherId, profile] of this.profiles) {
        if (otherId !== userId && profile.handle === patch.handle) {
          return { ok: false, error: "That handle is already taken." };
        }
      }
    }
    this.profiles.set(userId, { ...current, ...patch });
    return { ok: true };
  }

  // --- Sensitivity profiles (mirrors the immutable-version DB schema) ---

  private sensitivityProfiles = new Map<string, MockSensitivityProfile>();
  private codes: MockCode[] = [];

  listSensitivityProfiles(userId: string): MockSensitivityProfile[] {
    return [...this.sensitivityProfiles.values()]
      .filter((p) => p.userId === userId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getSensitivityProfile(userId: string, profileId: string): MockSensitivityProfile | null {
    const profile = this.sensitivityProfiles.get(profileId);
    return profile && profile.userId === userId ? profile : null;
  }

  createSensitivityProfile(
    userId: string,
    name: string,
    values: Record<string, number>,
  ): { ok: true; profileId: string } | { ok: false; error: string } {
    const exists = [...this.sensitivityProfiles.values()].some(
      (p) => p.userId === userId && p.name === name,
    );
    if (exists) return { ok: false, error: "You already have a profile with that name." };
    const profileId = randomUUID();
    const versionId = randomUUID();
    this.sensitivityProfiles.set(profileId, {
      id: profileId,
      userId,
      name,
      activeVersionId: versionId,
      versions: [
        {
          id: versionId,
          versionNo: 1,
          note: "Initial values",
          origin: "manual",
          createdAt: new Date().toISOString(),
          values: { ...values },
        },
      ],
    });
    return { ok: true, profileId };
  }

  /** Versions are immutable — every save appends and repoints active. */
  appendSensitivityVersion(
    userId: string,
    profileId: string,
    values: Record<string, number>,
    note: string,
    origin: string,
  ): { ok: true; versionNo: number } | { ok: false; error: string } {
    const profile = this.getSensitivityProfile(userId, profileId);
    if (!profile) return { ok: false, error: "Profile not found." };
    const versionNo = Math.max(...profile.versions.map((v) => v.versionNo)) + 1;
    const versionId = randomUUID();
    profile.versions.push({
      id: versionId,
      versionNo,
      note,
      origin,
      createdAt: new Date().toISOString(),
      values: { ...values },
    });
    profile.activeVersionId = versionId;
    return { ok: true, versionNo };
  }

  addCode(userId: string, profileId: string | null, kind: string, code: string, label: string | null): void {
    this.codes.push({
      id: randomUUID(),
      userId,
      profileId,
      kind,
      code,
      label,
      createdAt: new Date().toISOString(),
    });
  }

  listCodes(userId: string, profileId: string | null): MockCode[] {
    return this.codes.filter((c) => c.userId === userId && c.profileId === profileId);
  }

  // --- Community (posts/comments/reactions/reports) ---

  private posts: MockPost[] = [];
  private postComments: MockComment[] = [];
  private postReactions: MockReaction[] = [];
  private communityReports: MockReport[] = [];

  authorLabel(userId: string): string {
    const profile = this.profiles.get(userId);
    const user = this.usersById.get(userId);
    return profile?.displayName ?? user?.email.split("@")[0] ?? "player";
  }

  createPost(
    userId: string,
    kind: string,
    title: string,
    body: string,
    flagged: { flagged: boolean; reason: string | null },
  ): MockPost {
    const post: MockPost = {
      id: randomUUID(),
      authorId: userId,
      authorLabel: this.authorLabel(userId),
      kind,
      title,
      body,
      status: flagged.flagged ? "flagged" : "visible",
      autoFlagReason: flagged.reason,
      createdAt: new Date().toISOString(),
    };
    this.posts.push(post);
    return post;
  }

  listPosts(viewerId: string | null): MockPost[] {
    return [...this.posts]
      .filter((post) => post.status === "visible" || post.authorId === viewerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getPost(postId: string, viewerId: string | null): MockPost | null {
    const post = this.posts.find((p) => p.id === postId);
    if (!post) return null;
    if (post.status !== "visible" && post.authorId !== viewerId) return null;
    return post;
  }

  addComment(postId: string, userId: string, body: string): MockComment {
    const comment: MockComment = {
      id: randomUUID(),
      postId,
      authorId: userId,
      authorLabel: this.authorLabel(userId),
      body,
      createdAt: new Date().toISOString(),
    };
    this.postComments.push(comment);
    return comment;
  }

  listComments(postId: string): MockComment[] {
    return this.postComments
      .filter((c) => c.postId === postId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  toggleReaction(postId: string, userId: string, kind: string): void {
    const index = this.postReactions.findIndex(
      (r) => r.postId === postId && r.userId === userId && r.kind === kind,
    );
    if (index >= 0) {
      this.postReactions.splice(index, 1);
    } else {
      this.postReactions.push({ id: randomUUID(), postId, userId, kind });
    }
  }

  reactionCounts(postId: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const reaction of this.postReactions.filter((r) => r.postId === postId)) {
      counts[reaction.kind] = (counts[reaction.kind] ?? 0) + 1;
    }
    return counts;
  }

  addCommunityReport(
    reporterId: string,
    entityType: string,
    entityId: string,
    reason: string,
    detail: string | null,
  ): void {
    this.communityReports.push({
      id: randomUUID(),
      reporterId,
      entityType,
      entityId,
      reason,
      detail,
      status: "open",
      createdAt: new Date().toISOString(),
    });
  }

  listOwnReports(userId: string): MockReport[] {
    return this.communityReports.filter((r) => r.reporterId === userId);
  }

  // --- Control layouts (immutable versions, same shape as sensitivity) ---

  private controlLayouts = new Map<string, MockControlLayout>();

  listControlLayouts(userId: string): MockControlLayout[] {
    return [...this.controlLayouts.values()]
      .filter((l) => l.userId === userId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getControlLayout(userId: string, layoutId: string): MockControlLayout | null {
    const layout = this.controlLayouts.get(layoutId);
    return layout && layout.userId === userId ? layout : null;
  }

  createControlLayout(
    userId: string,
    name: string,
    fingerCount: number,
    positions: MockControlPosition[],
    analysis: MockControlAnalysis,
  ): { ok: true; layoutId: string } | { ok: false; error: string } {
    const exists = [...this.controlLayouts.values()].some(
      (l) => l.userId === userId && l.name === name,
    );
    if (exists) return { ok: false, error: "You already have a layout with that name." };
    const layoutId = randomUUID();
    const versionId = randomUUID();
    this.controlLayouts.set(layoutId, {
      id: layoutId,
      userId,
      name,
      fingerCount,
      activeVersionId: versionId,
      versions: [
        {
          id: versionId,
          versionNo: 1,
          note: "From template",
          origin: "template",
          createdAt: new Date().toISOString(),
          positions: positions.map((pos) => ({ ...pos })),
          analysis,
        },
      ],
    });
    return { ok: true, layoutId };
  }

  appendControlVersion(
    userId: string,
    layoutId: string,
    positions: MockControlPosition[],
    note: string,
    origin: string,
    analysis: MockControlAnalysis,
  ): { ok: true; versionNo: number } | { ok: false; error: string } {
    const layout = this.getControlLayout(userId, layoutId);
    if (!layout) return { ok: false, error: "Layout not found." };
    const versionNo = Math.max(...layout.versions.map((v) => v.versionNo)) + 1;
    const versionId = randomUUID();
    layout.versions.push({
      id: versionId,
      versionNo,
      note,
      origin,
      createdAt: new Date().toISOString(),
      positions: positions.map((pos) => ({ ...pos })),
      analysis,
    });
    layout.activeVersionId = versionId;
    return { ok: true, versionNo };
  }

  // --- Training sessions + drill results ---

  private trainingSessions = new Map<string, MockTrainingSession>();
  private drillResults: MockDrillResult[] = [];

  createTrainingSession(
    userId: string,
    input: { title: string; minutesPlanned: number; drillSlugs: string[]; planSlug: string | null },
  ): string {
    const id = randomUUID();
    this.trainingSessions.set(id, {
      id,
      userId,
      title: input.title,
      minutesPlanned: input.minutesPlanned,
      drillSlugs: input.drillSlugs,
      planSlug: input.planSlug,
      status: "in_progress",
      startedAt: new Date().toISOString(),
      completedAt: null,
      note: null,
    });
    return id;
  }

  getTrainingSession(userId: string, id: string): MockTrainingSession | null {
    const session = this.trainingSessions.get(id);
    return session && session.userId === userId ? session : null;
  }

  listTrainingSessions(userId: string): MockTrainingSession[] {
    return [...this.trainingSessions.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  completeTrainingSession(userId: string, id: string, note: string | null): boolean {
    const session = this.getTrainingSession(userId, id);
    if (!session) return false;
    session.status = "completed";
    session.completedAt = new Date().toISOString();
    session.note = note;
    return true;
  }

  logDrillResult(
    userId: string,
    sessionId: string | null,
    drillSlug: string,
    passed: boolean | null,
    selfRating: number | null,
    metricNote: string | null,
  ): void {
    this.drillResults.push({
      id: randomUUID(),
      userId,
      sessionId,
      drillSlug,
      passed,
      selfRating,
      metricNote,
      createdAt: new Date().toISOString(),
    });
  }

  listDrillResults(userId: string, sessionId?: string): MockDrillResult[] {
    return this.drillResults.filter(
      (r) => r.userId === userId && (sessionId === undefined || r.sessionId === sessionId),
    );
  }

  // --- AI coach pipeline (uploads, jobs, observations, reports) ---

  private uploads = new Map<string, MockUpload>();
  private analysisJobs = new Map<string, MockAnalysisJob>();
  private coachObservations: MockCoachObservation[] = [];
  private coachReports = new Map<string, MockCoachReport>();
  private coachRecommendations: MockCoachRecommendation[] = [];

  registerUpload(
    userId: string,
    input: { kind: string; label: string; durationSeconds: number | null },
  ): string {
    const id = randomUUID();
    this.uploads.set(id, {
      id,
      userId,
      kind: input.kind,
      label: input.label,
      durationSeconds: input.durationSeconds,
      status: "registered",
      createdAt: new Date().toISOString(),
    });
    return id;
  }

  getUpload(userId: string, uploadId: string): MockUpload | null {
    const upload = this.uploads.get(uploadId);
    return upload && upload.userId === userId ? upload : null;
  }

  listUploads(userId: string): MockUpload[] {
    return [...this.uploads.values()]
      .filter((u) => u.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  setUploadStatus(uploadId: string, status: MockUpload["status"]): void {
    const upload = this.uploads.get(uploadId);
    if (upload) upload.status = status;
  }

  /** Deleting an upload cascades away the derived pipeline (privacy). */
  deleteUpload(userId: string, uploadId: string): boolean {
    const upload = this.getUpload(userId, uploadId);
    if (!upload) return false;
    this.uploads.delete(uploadId);
    const job = this.getJobForUpload(uploadId);
    if (job) {
      this.analysisJobs.delete(job.id);
      this.coachObservations = this.coachObservations.filter((o) => o.jobId !== job.id);
      const report = [...this.coachReports.values()].find((r) => r.jobId === job.id);
      if (report) {
        this.coachReports.delete(report.id);
        this.coachRecommendations = this.coachRecommendations.filter(
          (r) => r.reportId !== report.id,
        );
      }
    }
    return true;
  }

  getJobForUpload(uploadId: string): MockAnalysisJob | null {
    return [...this.analysisJobs.values()].find((j) => j.uploadId === uploadId) ?? null;
  }

  countJobsSince(userId: string, sinceIso: string): number {
    return [...this.analysisJobs.values()].filter(
      (j) => j.userId === userId && j.createdAt >= sinceIso,
    ).length;
  }

  /** Idempotent: one job per upload — re-requests return the existing job. */
  createAnalysisJob(userId: string, uploadId: string): { jobId: string; created: boolean } {
    const existing = this.getJobForUpload(uploadId);
    if (existing) return { jobId: existing.id, created: false };
    const id = randomUUID();
    this.analysisJobs.set(id, {
      id,
      uploadId,
      userId,
      idempotencyKey: `analyze:${uploadId}`,
      status: "queued",
      attempts: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date().toISOString(),
    });
    this.setUploadStatus(uploadId, "queued");
    return { jobId: id, created: true };
  }

  /** The simulated worker: transitions the job and persists the artifacts. */
  completeAnalysisJob(
    jobId: string,
    result: {
      observations: Array<{
        tSeconds: number;
        category: string;
        observation: string;
        inference: boolean;
        confidence: string;
      }>;
      report: Omit<
        MockCoachReport,
        "id" | "jobId" | "userId" | "reviewStatus" | "reviewedBy" | "reviewedAt" | "createdAt"
      >;
      recommendations: Array<{ drillSlug: string; reason: string }>;
    },
  ): string | null {
    const job = this.analysisJobs.get(jobId);
    if (!job) return null;
    const now = new Date().toISOString();
    job.status = "succeeded";
    job.attempts += 1;
    job.startedAt = now;
    job.finishedAt = now;
    job.error = null;
    this.setUploadStatus(job.uploadId, "complete");
    this.coachObservations = this.coachObservations.filter((o) => o.jobId !== jobId);
    for (const o of result.observations) {
      this.coachObservations.push({ id: randomUUID(), jobId, ...o });
    }
    const reportId = randomUUID();
    this.coachReports.set(reportId, {
      id: reportId,
      jobId,
      userId: job.userId,
      ...result.report,
      reviewStatus: "pending_review",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now,
    });
    for (const rec of result.recommendations) {
      this.coachRecommendations.push({ id: randomUUID(), reportId, ...rec });
    }
    return reportId;
  }

  failAnalysisJob(jobId: string, error: string): void {
    const job = this.analysisJobs.get(jobId);
    if (!job) return;
    const now = new Date().toISOString();
    job.status = "failed";
    job.attempts += 1;
    job.startedAt = job.startedAt ?? now;
    job.finishedAt = now;
    job.error = error;
    this.setUploadStatus(job.uploadId, "failed");
  }

  listObservations(jobId: string): MockCoachObservation[] {
    return this.coachObservations
      .filter((o) => o.jobId === jobId)
      .sort((a, b) => a.tSeconds - b.tSeconds);
  }

  getCoachReport(reportId: string): MockCoachReport | null {
    return this.coachReports.get(reportId) ?? null;
  }

  getCoachReportForJob(jobId: string): MockCoachReport | null {
    return [...this.coachReports.values()].find((r) => r.jobId === jobId) ?? null;
  }

  listRecommendations(reportId: string): MockCoachRecommendation[] {
    return this.coachRecommendations.filter((r) => r.reportId === reportId);
  }

  listReportsPendingReview(): MockCoachReport[] {
    return [...this.coachReports.values()]
      .filter((r) => r.reviewStatus === "pending_review")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  reviewCoachReport(
    editorId: string,
    reportId: string,
    decision: "published" | "rejected",
  ): boolean {
    const report = this.coachReports.get(reportId);
    if (!report) return false;
    report.reviewStatus = decision;
    report.reviewedBy = editorId;
    report.reviewedAt = new Date().toISOString();
    return true;
  }

  /**
   * Mirrors server-side role granting (service-role tooling in real Supabase).
   * There is intentionally no way to reach this from a client session.
   */
  grantRole(userId: string, roleSlug: string): void {
    const existing = this.roles.get(userId) ?? new Set<string>();
    existing.add(roleSlug);
    this.roles.set(userId, existing);
  }

  getRoles(userId: string): string[] {
    return [...(this.roles.get(userId) ?? [])];
  }
}

/** Survives Next.js dev-server module reloads. */
const globalStore = globalThis as unknown as { __clutchlabMockAuthStore?: MockAuthStore };

export function getMockAuthStore(): MockAuthStore {
  globalStore.__clutchlabMockAuthStore ??= new MockAuthStore();
  return globalStore.__clutchlabMockAuthStore;
}
