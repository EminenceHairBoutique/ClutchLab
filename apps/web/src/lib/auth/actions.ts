"use server";

import { getServerEnv } from "@clutchlab/config/env";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authMode, getAuthGateway } from "./gateway";
import { createServerSupabase } from "./supabase-server";

export interface AuthFormState {
  error: string | null;
  notice: string | null;
}

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

function parseCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseCredentials(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input.", notice: null };
  }
  const result = await getAuthGateway().signUpWithPassword(
    parsed.data.email,
    parsed.data.password,
  );
  if (!result.ok) return { error: result.error, notice: null };
  if (result.requiresEmailConfirmation) {
    return {
      error: null,
      notice: "Check your inbox — confirm your email address to finish creating the account.",
    };
  }
  redirect("/profile");
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseCredentials(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input.", notice: null };
  }
  const result = await getAuthGateway().signInWithPassword(
    parsed.data.email,
    parsed.data.password,
  );
  if (!result.ok) return { error: result.error, notice: null };
  redirect("/profile");
}

export async function signOutAction(): Promise<void> {
  await getAuthGateway().signOut();
  redirect("/");
}

const oauthProviderSchema = z.enum(["google", "apple"]);

export async function signInWithOAuthAction(formData: FormData): Promise<void> {
  const provider = oauthProviderSchema.parse(formData.get("provider"));
  if (authMode() !== "supabase") {
    // OAuth requires a real Supabase project; buttons are hidden in mock mode.
    redirect("/login");
  }
  const env = getServerEnv();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  });
  if (error || !data.url) {
    redirect("/login?error=oauth");
  }
  redirect(data.url);
}
