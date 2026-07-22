import "server-only";

import { DRILLS, SKILLS, TRAINING_PLANS, WOW_MAPS, type DrillRecord } from "@clutchlab/content";

import { authMode } from "@/lib/auth/gateway";
import { getMockAuthStore } from "@/lib/auth/mock-store";
import { createServerSupabase } from "@/lib/auth/supabase-server";

import type { Provenance } from "./meta-store";

/**
 * Training academy store. Catalog reads come from the bundled content (which is
 * identical to the seed) in unconfigured mode, or the database when connected.
 * User sessions/results always come from the user-scoped store.
 */

export interface DrillView {
  slug: string;
  name: string;
  skillSlug: string;
  skillName: string;
  category: string;
  difficulty: DrillRecord["difficulty"];
  durationMinutes: number;
  objective: string;
  aimAssistVariant: string | null;
}

export interface SessionView {
  id: string;
  title: string;
  minutesPlanned: number;
  status: string;
  planSlug: string | null;
  drillSlugs: string[];
  startedAt: string | null;
  completedAt: string | null;
  note: string | null;
  results: Array<{
    drillSlug: string;
    passed: boolean | null;
    selfRating: number | null;
    metricNote: string | null;
  }>;
}

export interface WeeklySummary {
  sessionsCompleted: number;
  drillsLogged: number;
  passRate: number | null;
  minutesCompleted: number;
}

/** §5.14 report cadence — daily/weekly/monthly windows + practice streak. */
export interface TrainingReports {
  daily: WeeklySummary;
  weekly: WeeklySummary;
  monthly: WeeklySummary;
  /** Consecutive days (ending today or yesterday) with logged practice. */
  streakDays: number;
}

/** Streak from activity dates (YYYY-MM-DD): counts back from today, or from
 * yesterday when today has no practice yet — an unbroken streak stays alive
 * until a full day is missed. */
export function computeStreak(activityDates: ReadonlySet<string>, now = new Date()): number {
  const day = (offset: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  let offset = activityDates.has(day(0)) ? 0 : 1;
  let streak = 0;
  while (activityDates.has(day(offset))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}

const skillBySlug = new Map(SKILLS.map((s) => [s.slug, s]));

export function catalogProvenance(): Provenance {
  return authMode() === "supabase" ? "database" : "bundled-baseline";
}

/** Catalog reads are served from the bundled records in BOTH modes for Phase 4:
 * the seed is generated from the same source, so content is identical; live
 * DB reads swap in when editorial changes need to surface without deploys. */
export function listDrillViews(): DrillView[] {
  return DRILLS.map((d) => ({
    slug: d.slug,
    name: d.name,
    skillSlug: d.skillSlug,
    skillName: skillBySlug.get(d.skillSlug)?.name ?? d.skillSlug,
    category: skillBySlug.get(d.skillSlug)?.category ?? "other",
    difficulty: d.difficulty,
    durationMinutes: d.durationMinutes,
    objective: d.objective,
    aimAssistVariant: d.aimAssistVariant,
  }));
}

export function getDrillRecord(slug: string): DrillRecord | null {
  return DRILLS.find((d) => d.slug === slug) ?? null;
}

export function listPlanRecords() {
  return TRAINING_PLANS;
}

export function getPlanRecord(slug: string) {
  return TRAINING_PLANS.find((p) => p.slug === slug) ?? null;
}

export function listWowRecords() {
  return WOW_MAPS;
}

export interface TrainingUserStore {
  createSession(
    userId: string,
    input: { title: string; minutesPlanned: number; drillSlugs: string[]; planSlug: string | null },
  ): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }>;
  getSession(userId: string, sessionId: string): Promise<SessionView | null>;
  listRecentSessions(userId: string, limit: number): Promise<SessionView[]>;
  logResult(
    userId: string,
    sessionId: string | null,
    drillSlug: string,
    passed: boolean | null,
    selfRating: number | null,
    metricNote: string | null,
  ): Promise<{ ok: boolean; error?: string }>;
  completeSession(userId: string, sessionId: string, note: string | null): Promise<boolean>;
  weeklySummary(userId: string): Promise<WeeklySummary>;
  reports(userId: string): Promise<TrainingReports>;
}

class MockTrainingStore implements TrainingUserStore {
  async createSession(
    userId: string,
    input: { title: string; minutesPlanned: number; drillSlugs: string[]; planSlug: string | null },
  ) {
    const sessionId = getMockAuthStore().createTrainingSession(userId, input);
    return { ok: true as const, sessionId };
  }

  async getSession(userId: string, sessionId: string): Promise<SessionView | null> {
    const session = getMockAuthStore().getTrainingSession(userId, sessionId);
    if (!session) return null;
    const results = getMockAuthStore().listDrillResults(userId, sessionId);
    return {
      id: session.id,
      title: session.title,
      minutesPlanned: session.minutesPlanned,
      status: session.status,
      planSlug: session.planSlug,
      drillSlugs: session.drillSlugs,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      note: session.note,
      results: results.map((r) => ({
        drillSlug: r.drillSlug,
        passed: r.passed,
        selfRating: r.selfRating,
        metricNote: r.metricNote,
      })),
    };
  }

  async listRecentSessions(userId: string, limit: number): Promise<SessionView[]> {
    const sessions = getMockAuthStore().listTrainingSessions(userId).slice(0, limit);
    return Promise.all(sessions.map((s) => this.getSession(userId, s.id))).then((list) =>
      list.filter((s): s is SessionView => s !== null),
    );
  }

  async logResult(
    userId: string,
    sessionId: string | null,
    drillSlug: string,
    passed: boolean | null,
    selfRating: number | null,
    metricNote: string | null,
  ) {
    getMockAuthStore().logDrillResult(userId, sessionId, drillSlug, passed, selfRating, metricNote);
    return { ok: true };
  }

  async completeSession(userId: string, sessionId: string, note: string | null): Promise<boolean> {
    return getMockAuthStore().completeTrainingSession(userId, sessionId, note);
  }

  private summarize(userId: string, sinceMs: number): WeeklySummary {
    const store = getMockAuthStore();
    const sessions = store
      .listTrainingSessions(userId)
      .filter((s) => s.status === "completed" && Date.parse(s.startedAt) >= sinceMs);
    const results = store
      .listDrillResults(userId)
      .filter((r) => Date.parse(r.createdAt) >= sinceMs);
    const judged = results.filter((r) => r.passed !== null);
    return {
      sessionsCompleted: sessions.length,
      drillsLogged: results.length,
      passRate:
        judged.length > 0
          ? Math.round((judged.filter((r) => r.passed).length / judged.length) * 100)
          : null,
      minutesCompleted: sessions.reduce((sum, s) => sum + s.minutesPlanned, 0),
    };
  }

  async weeklySummary(userId: string): Promise<WeeklySummary> {
    return this.summarize(userId, Date.now() - 7 * 86_400_000);
  }

  async reports(userId: string): Promise<TrainingReports> {
    const store = getMockAuthStore();
    const dates = new Set<string>();
    for (const s of store.listTrainingSessions(userId)) {
      if (s.status === "completed") dates.add(s.startedAt.slice(0, 10));
    }
    for (const r of store.listDrillResults(userId)) {
      dates.add(r.createdAt.slice(0, 10));
    }
    return {
      daily: this.summarize(userId, Date.now() - 86_400_000),
      weekly: this.summarize(userId, Date.now() - 7 * 86_400_000),
      monthly: this.summarize(userId, Date.now() - 30 * 86_400_000),
      streakDays: computeStreak(dates),
    };
  }
}

class SupabaseTrainingStore implements TrainingUserStore {
  async createSession(
    userId: string,
    input: { title: string; minutesPlanned: number; drillSlugs: string[]; planSlug: string | null },
  ) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("user_training_sessions")
      .insert({
        user_id: userId,
        title: input.title,
        minutes_planned: input.minutesPlanned,
        drill_slugs: input.drillSlugs,
        plan_slug: input.planSlug,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, sessionId: data.id };
  }

  // RLS scopes every query to the caller's session; userId params stay for interface parity.
  async getSession(_userId: string, sessionId: string): Promise<SessionView | null> {
    const supabase = await createServerSupabase();
    const { data: session, error } = await supabase
      .from("user_training_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw new Error(`session read failed: ${error.message}`);
    if (!session) return null;
    const { data: results, error: resultsError } = await supabase
      .from("drill_results")
      .select("drill_slug, passed, self_rating, metric_note")
      .eq("session_id", sessionId);
    if (resultsError) throw new Error(`results read failed: ${resultsError.message}`);
    return {
      id: session.id,
      title: session.title,
      minutesPlanned: session.minutes_planned,
      status: session.status,
      planSlug: session.plan_slug,
      drillSlugs: session.drill_slugs,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      note: session.note,
      results: results.map((r) => ({
        drillSlug: r.drill_slug,
        passed: r.passed,
        selfRating: r.self_rating,
        metricNote: r.metric_note,
      })),
    };
  }

  async listRecentSessions(userId: string, limit: number): Promise<SessionView[]> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("user_training_sessions")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`sessions read failed: ${error.message}`);
    const sessions = await Promise.all(data.map((s) => this.getSession(userId, s.id)));
    return sessions.filter((s): s is SessionView => s !== null);
  }

  async logResult(
    userId: string,
    sessionId: string | null,
    drillSlug: string,
    passed: boolean | null,
    selfRating: number | null,
    metricNote: string | null,
  ) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("drill_results").insert({
      user_id: userId,
      session_id: sessionId,
      drill_slug: drillSlug,
      passed,
      self_rating: selfRating,
      metric_note: metricNote,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async completeSession(_userId: string, sessionId: string, note: string | null): Promise<boolean> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("user_training_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString(), note })
      .eq("id", sessionId)
      .select("id");
    return !error && data.length > 0;
  }

  private async summarize(sinceIso: string): Promise<WeeklySummary> {
    const supabase = await createServerSupabase();
    const [sessionsRes, resultsRes] = await Promise.all([
      supabase
        .from("user_training_sessions")
        .select("minutes_planned")
        .eq("status", "completed")
        .gte("started_at", sinceIso),
      supabase.from("drill_results").select("passed").gte("created_at", sinceIso),
    ]);
    if (sessionsRes.error) throw new Error(sessionsRes.error.message);
    if (resultsRes.error) throw new Error(resultsRes.error.message);
    const judged = resultsRes.data.filter((r) => r.passed !== null);
    return {
      sessionsCompleted: sessionsRes.data.length,
      drillsLogged: resultsRes.data.length,
      passRate:
        judged.length > 0
          ? Math.round((judged.filter((r) => r.passed).length / judged.length) * 100)
          : null,
      minutesCompleted: sessionsRes.data.reduce((sum, s) => sum + s.minutes_planned, 0),
    };
  }

  async weeklySummary(_userId: string): Promise<WeeklySummary> {
    return this.summarize(new Date(Date.now() - 7 * 86_400_000).toISOString());
  }

  async reports(_userId: string): Promise<TrainingReports> {
    const supabase = await createServerSupabase();
    // Streak window: 60 days of activity dates is plenty for a daily streak.
    const sinceIso = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const [sessionsRes, resultsRes] = await Promise.all([
      supabase
        .from("user_training_sessions")
        .select("started_at")
        .eq("status", "completed")
        .gte("started_at", sinceIso),
      supabase.from("drill_results").select("created_at").gte("created_at", sinceIso),
    ]);
    if (sessionsRes.error) throw new Error(sessionsRes.error.message);
    if (resultsRes.error) throw new Error(resultsRes.error.message);
    const dates = new Set<string>();
    for (const s of sessionsRes.data) dates.add(String(s.started_at).slice(0, 10));
    for (const r of resultsRes.data) dates.add(String(r.created_at).slice(0, 10));
    return {
      daily: await this.summarize(new Date(Date.now() - 86_400_000).toISOString()),
      weekly: await this.summarize(new Date(Date.now() - 7 * 86_400_000).toISOString()),
      monthly: await this.summarize(new Date(Date.now() - 30 * 86_400_000).toISOString()),
      streakDays: computeStreak(dates),
    };
  }
}

export function getTrainingUserStore(): TrainingUserStore {
  return authMode() === "supabase" ? new SupabaseTrainingStore() : new MockTrainingStore();
}
