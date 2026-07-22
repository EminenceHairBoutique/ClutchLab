export interface AuthUser {
  id: string;
  email: string | null;
}

export type AuthActionResult =
  | { ok: true; requiresEmailConfirmation?: boolean }
  | { ok: false; error: string };

/**
 * Minimal auth surface the app consumes. Two implementations:
 * - supabase.ts (real, via @supabase/ssr) when Supabase env is configured
 * - auth.mock.ts (in-memory, dev/test only) otherwise — spec §0.1.7 honest placeholder
 */
export interface AuthGateway {
  getUser(): Promise<AuthUser | null>;
  signUpWithPassword(email: string, password: string): Promise<AuthActionResult>;
  signInWithPassword(email: string, password: string): Promise<AuthActionResult>;
  signOut(): Promise<void>;
}
