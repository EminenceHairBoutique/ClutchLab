import { cookies } from "next/headers";

import { getMockAuthStore } from "./mock-store";
import type { AuthActionResult, AuthGateway, AuthUser } from "./types";

/**
 * MOCK auth adapter (spec §0.1.7): active only when Supabase is not configured
 * or AUTH_MOCK=1, and never in production (env validation enforces this).
 * The UI shows a visible mock-mode banner whenever this adapter is in use.
 */

export const MOCK_SESSION_COOKIE = "clutchlab_mock_session";

export class MockAuthGateway implements AuthGateway {
  async getUser(): Promise<AuthUser | null> {
    const cookieStore = await cookies();
    const user = getMockAuthStore().getUserBySession(cookieStore.get(MOCK_SESSION_COOKIE)?.value);
    return user ? { id: user.id, email: user.email } : null;
  }

  async signUpWithPassword(email: string, password: string): Promise<AuthActionResult> {
    const store = getMockAuthStore();
    const created = store.createUser(email, password);
    if (!created.ok) return created;
    await this.startSession(created.user.id);
    return { ok: true };
  }

  async signInWithPassword(email: string, password: string): Promise<AuthActionResult> {
    const user = getMockAuthStore().verifyPassword(email, password);
    if (!user) return { ok: false, error: "Invalid email or password." };
    await this.startSession(user.id);
    return { ok: true };
  }

  async signOut(): Promise<void> {
    const cookieStore = await cookies();
    getMockAuthStore().deleteSession(cookieStore.get(MOCK_SESSION_COOKIE)?.value);
    cookieStore.delete(MOCK_SESSION_COOKIE);
  }

  private async startSession(userId: string): Promise<void> {
    const token = getMockAuthStore().createSession(userId);
    const cookieStore = await cookies();
    cookieStore.set(MOCK_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
}
