import "server-only";

import { getServerEnv, resolveAuthMode, type AuthMode } from "@clutchlab/config/env";
import { redirect } from "next/navigation";

import { MockAuthGateway } from "./auth.mock";
import { SupabaseAuthGateway } from "./supabase-server";
import type { AuthGateway, AuthUser } from "./types";

export function authMode(): AuthMode {
  return resolveAuthMode(getServerEnv());
}

export function getAuthGateway(): AuthGateway {
  return authMode() === "supabase" ? new SupabaseAuthGateway() : new MockAuthGateway();
}

export async function getSessionUser(): Promise<AuthUser | null> {
  return getAuthGateway().getUser();
}

/** For pages/actions that require a signed-in user. Redirects guests to /login. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
