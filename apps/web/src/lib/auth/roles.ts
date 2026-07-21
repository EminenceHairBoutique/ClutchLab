import "server-only";

import { ROLE_RANKS, type RoleSlug } from "@clutchlab/types";

import { authMode } from "./gateway";
import { getMockAuthStore } from "./mock-store";
import { createServerSupabase } from "./supabase-server";
import type { AuthUser } from "./types";

/**
 * Server-authoritative role checks (spec §13 / CLAUDE.md hard rule: never trust
 * client role claims). In Supabase mode the check runs IN the database via the
 * security-definer public.has_role_at_least() under the caller's own session.
 */

export function roleAtLeast(roles: readonly string[], min: RoleSlug): boolean {
  const minRank = ROLE_RANKS[min];
  return roles.some((slug) => (ROLE_RANKS[slug as RoleSlug] ?? 0) >= minRank);
}

export async function getUserRoles(user: AuthUser): Promise<string[]> {
  if (authMode() === "supabase") {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.from("user_roles").select("role_slug");
    if (error) throw new Error(`user_roles read failed: ${error.message}`);
    return data.map((row) => row.role_slug);
  }
  return getMockAuthStore().getRoles(user.id);
}

export async function checkRoleAtLeast(user: AuthUser, min: RoleSlug): Promise<boolean> {
  if (authMode() === "supabase") {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("has_role_at_least", { required_role: min });
    if (error) throw new Error(`role check failed: ${error.message}`);
    return data === true;
  }
  return roleAtLeast(getMockAuthStore().getRoles(user.id), min);
}
