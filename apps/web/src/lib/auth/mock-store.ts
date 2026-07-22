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

export interface MockCoachProfile {
  userId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  region: string | null;
  languages: string[];
  credentials: string | null;
  availabilityNote: string | null;
  verified: boolean;
  acceptingBookings: boolean;
  dataStatus: "verified" | "unverified" | "sample";
  createdAt: string;
}

export interface MockCoachService {
  id: string;
  coachId: string;
  kind: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  deliveryDays: number;
  active: boolean;
}

export interface MockBooking {
  id: string;
  serviceId: string;
  coachId: string;
  playerId: string;
  status: "requested" | "accepted" | "declined" | "delivered" | "completed" | "canceled" | "disputed";
  note: string | null;
  deliverable: string | null;
  respondedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface MockOrder {
  id: string;
  bookingId: string;
  playerId: string;
  coachId: string;
  amountCents: number;
  currency: string;
  platformFeeCents: number;
  coachNetCents: number;
  status: "pending_payment" | "paid" | "refunded" | "disputed";
  payoutStatus: "not_due" | "pending" | "paid";
  paidAt: string | null;
  payoutAt: string | null;
  createdAt: string;
}

export interface MockMarketplaceReview {
  id: string;
  bookingId: string;
  coachId: string;
  playerId: string;
  rating: number;
  body: string | null;
  createdAt: string;
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
    // Mock-only demo affordance: an email starting with "editor-" gets the
    // editor role (review tooling) and "admin-" gets admin (payout workflow),
    // so staff surfaces are demoable without a database. Real Supabase role
    // grants are server-side only (see SETUP.md); the mock store cannot run
    // in production (env validation forbids it).
    if (normalized.startsWith("editor-")) {
      this.grantRole(user.id, "editor");
    }
    if (normalized.startsWith("admin-")) {
      this.grantRole(user.id, "admin");
    }
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

  // --- Billing (mock plan state; Supabase mode reads subscriptions) ---

  private plans = new Map<
    string,
    { plan: "free" | "pro" | "elite"; status: string; cancelAtPeriodEnd: boolean }
  >();

  getPlanState(userId: string): {
    plan: "free" | "pro" | "elite";
    status: string;
    cancelAtPeriodEnd: boolean;
  } {
    return this.plans.get(userId) ?? { plan: "free", status: "active", cancelAtPeriodEnd: false };
  }

  /** Mock checkout/portal outcome — mirrors what Stripe webhooks would write. */
  setPlanState(userId: string, plan: "free" | "pro" | "elite", cancelAtPeriodEnd = false): void {
    this.plans.set(userId, { plan, status: "active", cancelAtPeriodEnd });
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

  // --- Coach marketplace (profiles, services, bookings, orders, reviews) ---

  private coachProfiles = new Map<string, MockCoachProfile>();
  private coachServices = new Map<string, MockCoachService>();
  private bookings = new Map<string, MockBooking>();
  private orders = new Map<string, MockOrder>();
  private marketplaceReviews: MockMarketplaceReview[] = [];
  private marketplaceSeeded = false;

  /**
   * Sample coaches (dataStatus 'sample', clearly fictional, NOT accepting
   * bookings) so the directory demonstrates the marketplace without implying
   * real people. The real booking loop runs against user-created coaches.
   */
  private ensureMarketplaceSeed(): void {
    if (this.marketplaceSeeded) return;
    this.marketplaceSeeded = true;
    const samples: Array<{
      profile: Omit<MockCoachProfile, "createdAt">;
      services: Array<Omit<MockCoachService, "id" | "coachId">>;
    }> = [
      {
        profile: {
          userId: "sample-coach-emberline",
          displayName: "Emberline (sample)",
          headline: "IGL-turned-coach focused on entry discipline and trades",
          bio: "Sample coach profile for demonstration. Reviews are written async with timestamped notes.",
          region: "EU",
          languages: ["en", "de"],
          credentials: "Sample data — 3 seasons of competitive scrims (fictional).",
          availabilityNote: "Demo profile — not accepting bookings.",
          verified: true,
          acceptingBookings: false,
          dataStatus: "sample",
        },
        services: [
          { kind: "clip_review", title: "Async clip review with written notes", description: "One clip up to 3 minutes, timestamped feedback.", priceCents: 1500, currency: "usd", deliveryDays: 3, active: true },
          { kind: "sensitivity_calibration", title: "Guided sensitivity calibration session", description: "Works through the ClutchLab calibration flow with you.", priceCents: 2500, currency: "usd", deliveryDays: 5, active: true },
        ],
      },
      {
        profile: {
          userId: "sample-coach-kitefall",
          displayName: "Kitefall (sample)",
          headline: "Full-match VOD analysis, rotation-first",
          bio: "Sample coach profile for demonstration. Focus on macro decisions over aim blame.",
          region: "SEA",
          languages: ["en", "id"],
          credentials: "Sample data — former scrim analyst (fictional).",
          availabilityNote: "Demo profile — not accepting bookings.",
          verified: true,
          acceptingBookings: false,
          dataStatus: "sample",
        },
        services: [
          { kind: "full_match_review", title: "Full-match rotation review", description: "Zone by zone: where the lobby was, where you should have been.", priceCents: 3000, currency: "usd", deliveryDays: 4, active: true },
          { kind: "map_strategy", title: "Map strategy session (Erangel/Miramar)", description: "Drop plans, mid-game routes, endgame anchors.", priceCents: 2000, currency: "usd", deliveryDays: 3, active: true },
        ],
      },
      {
        profile: {
          userId: "sample-coach-veracity",
          displayName: "Veracity (sample)",
          headline: "Controls and ergonomics specialist",
          bio: "Sample coach profile for demonstration. Layout reviews use the ergonomics report you already have.",
          region: "NA",
          languages: ["en", "es"],
          credentials: "Sample data — claw-grip layout theorist (fictional).",
          availabilityNote: "Demo profile — not accepting bookings.",
          verified: true,
          acceptingBookings: false,
          dataStatus: "sample",
        },
        services: [
          { kind: "control_layout_review", title: "Control layout + ergonomics review", description: "Your layout against your hand size, fingers, and device.", priceCents: 1800, currency: "usd", deliveryDays: 3, active: true },
          { kind: "ultimate_royale_prep", title: "Ultimate Royale preparation", description: "Mode-specific loadouts, spawns, and pacing.", priceCents: 2200, currency: "usd", deliveryDays: 5, active: true },
        ],
      },
    ];
    const now = new Date().toISOString();
    for (const sample of samples) {
      this.coachProfiles.set(sample.profile.userId, { ...sample.profile, createdAt: now });
      for (const service of sample.services) {
        const id = randomUUID();
        this.coachServices.set(id, { ...service, id, coachId: sample.profile.userId });
      }
    }
  }

  upsertCoachProfile(
    userId: string,
    input: Omit<
      MockCoachProfile,
      "userId" | "verified" | "acceptingBookings" | "dataStatus" | "createdAt"
    > & { acceptingBookings: boolean },
  ): void {
    this.ensureMarketplaceSeed();
    const existing = this.coachProfiles.get(userId);
    this.coachProfiles.set(userId, {
      userId,
      ...input,
      // Verification is editorial; a profile edit never grants it.
      verified: existing?.verified ?? false,
      dataStatus: existing?.dataStatus ?? "unverified",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  }

  getCoachProfile(userId: string): MockCoachProfile | null {
    this.ensureMarketplaceSeed();
    return this.coachProfiles.get(userId) ?? null;
  }

  listVerifiedCoaches(): MockCoachProfile[] {
    this.ensureMarketplaceSeed();
    return [...this.coachProfiles.values()]
      .filter((c) => c.verified)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  listUnverifiedCoaches(): MockCoachProfile[] {
    this.ensureMarketplaceSeed();
    return [...this.coachProfiles.values()]
      .filter((c) => !c.verified)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  setCoachVerified(userId: string, verified: boolean): boolean {
    const profile = this.coachProfiles.get(userId);
    if (!profile) return false;
    profile.verified = verified;
    return true;
  }

  addCoachService(
    coachId: string,
    input: Omit<MockCoachService, "id" | "coachId">,
  ): string {
    const id = randomUUID();
    this.coachServices.set(id, { ...input, id, coachId });
    return id;
  }

  listCoachServices(coachId: string, activeOnly: boolean): MockCoachService[] {
    this.ensureMarketplaceSeed();
    return [...this.coachServices.values()].filter(
      (s) => s.coachId === coachId && (!activeOnly || s.active),
    );
  }

  getCoachService(serviceId: string): MockCoachService | null {
    this.ensureMarketplaceSeed();
    return this.coachServices.get(serviceId) ?? null;
  }

  createBooking(
    playerId: string,
    service: MockCoachService,
    note: string | null,
    fees: { platformFeeCents: number; coachNetCents: number },
  ): string {
    const now = new Date().toISOString();
    const bookingId = randomUUID();
    this.bookings.set(bookingId, {
      id: bookingId,
      serviceId: service.id,
      coachId: service.coachId,
      playerId,
      status: "requested",
      note,
      deliverable: null,
      respondedAt: null,
      deliveredAt: null,
      completedAt: null,
      createdAt: now,
    });
    // Mock payment: order paid immediately (no Stripe Connect in demo mode).
    const orderId = randomUUID();
    this.orders.set(orderId, {
      id: orderId,
      bookingId,
      playerId,
      coachId: service.coachId,
      amountCents: service.priceCents,
      currency: service.currency,
      platformFeeCents: fees.platformFeeCents,
      coachNetCents: fees.coachNetCents,
      status: "paid",
      payoutStatus: "not_due",
      paidAt: now,
      payoutAt: null,
      createdAt: now,
    });
    return bookingId;
  }

  getBooking(bookingId: string): MockBooking | null {
    return this.bookings.get(bookingId) ?? null;
  }

  listBookingsForPlayer(playerId: string): MockBooking[] {
    return [...this.bookings.values()]
      .filter((b) => b.playerId === playerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listBookingsForCoach(coachId: string): MockBooking[] {
    return [...this.bookings.values()]
      .filter((b) => b.coachId === coachId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getOrderForBooking(bookingId: string): MockOrder | null {
    return [...this.orders.values()].find((o) => o.bookingId === bookingId) ?? null;
  }

  respondToBooking(coachId: string, bookingId: string, accept: boolean): boolean {
    const booking = this.bookings.get(bookingId);
    if (!booking || booking.coachId !== coachId || booking.status !== "requested") return false;
    booking.status = accept ? "accepted" : "declined";
    booking.respondedAt = new Date().toISOString();
    if (!accept) {
      const order = this.getOrderForBooking(bookingId);
      if (order) order.status = "refunded";
    }
    return true;
  }

  deliverBooking(coachId: string, bookingId: string, deliverable: string): boolean {
    const booking = this.bookings.get(bookingId);
    if (!booking || booking.coachId !== coachId || booking.status !== "accepted") return false;
    booking.status = "delivered";
    booking.deliverable = deliverable;
    booking.deliveredAt = new Date().toISOString();
    return true;
  }

  completeBooking(playerId: string, bookingId: string): boolean {
    const booking = this.bookings.get(bookingId);
    if (!booking || booking.playerId !== playerId || booking.status !== "delivered") return false;
    booking.status = "completed";
    booking.completedAt = new Date().toISOString();
    const order = this.getOrderForBooking(bookingId);
    if (order && order.status === "paid") order.payoutStatus = "pending";
    return true;
  }

  addMarketplaceReview(
    playerId: string,
    bookingId: string,
    rating: number,
    body: string | null,
  ): { ok: boolean; error?: string } {
    const booking = this.bookings.get(bookingId);
    if (!booking || booking.playerId !== playerId) return { ok: false, error: "Booking not found." };
    if (booking.status !== "completed") {
      return { ok: false, error: "Reviews unlock after you confirm delivery." };
    }
    if (this.marketplaceReviews.some((r) => r.bookingId === bookingId)) {
      return { ok: false, error: "You already reviewed this booking." };
    }
    this.marketplaceReviews.push({
      id: randomUUID(),
      bookingId,
      coachId: booking.coachId,
      playerId,
      rating,
      body,
      createdAt: new Date().toISOString(),
    });
    return { ok: true };
  }

  listMarketplaceReviews(coachId: string): MockMarketplaceReview[] {
    return this.marketplaceReviews
      .filter((r) => r.coachId === coachId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listPendingPayouts(): MockOrder[] {
    return [...this.orders.values()]
      .filter((o) => o.status === "paid" && o.payoutStatus === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  markPayoutPaid(orderId: string): boolean {
    const order = [...this.orders.values()].find((o) => o.id === orderId);
    if (!order || order.payoutStatus !== "pending") return false;
    order.payoutStatus = "paid";
    order.payoutAt = new Date().toISOString();
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
