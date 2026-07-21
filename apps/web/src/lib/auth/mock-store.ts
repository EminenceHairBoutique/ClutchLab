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
