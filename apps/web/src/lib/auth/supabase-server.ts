import { getServerEnv } from "@clutchlab/config/env";
import type { Database } from "@clutchlab/types";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { AuthActionResult, AuthGateway, AuthUser } from "./types";

export async function createServerSupabase() {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured — check NEXT_PUBLIC_SUPABASE_URL/ANON_KEY.");
  }
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, which cannot write cookies.
            // Safe to ignore: middleware refreshes sessions on navigation.
          }
        },
      },
    },
  );
}

/**
 * Service-role client for cookie-less server contexts (Stripe webhooks, jobs).
 * BYPASSES RLS — use only where the request is authenticated by other means
 * (e.g. a verified webhook signature). Never import from client code.
 */
export function createServiceSupabase() {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Service-role Supabase is not configured — check NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class SupabaseAuthGateway implements AuthGateway {
  async getUser(): Promise<AuthUser | null> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  }

  async signUpWithPassword(email: string, password: string): Promise<AuthActionResult> {
    const env = getServerEnv();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback` },
    });
    if (error) return { ok: false, error: error.message };
    // Supabase returns an obfuscated user with no identities when the email is taken.
    if (data.user && data.user.identities?.length === 0) {
      return { ok: false, error: "An account with this email already exists." };
    }
    return { ok: true, requiresEmailConfirmation: !data.session };
  }

  async signInWithPassword(email: string, password: string): Promise<AuthActionResult> {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: "Invalid email or password." };
    return { ok: true };
  }

  async signOut(): Promise<void> {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
}
