import { NextResponse } from "next/server";

import { authMode } from "@/lib/auth/gateway";
import { createServerSupabase } from "@/lib/auth/supabase-server";

/** OAuth / email-confirmation code exchange (Supabase PKCE flow). */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/profile";

  if (authMode() === "supabase" && code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login?error=auth_callback", url.origin));
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
