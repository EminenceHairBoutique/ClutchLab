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
