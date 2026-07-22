import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CredentialsForm } from "@/components/auth/credentials-form";
import { MockModeBanner } from "@/components/auth/mock-mode-banner";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { signInAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/gateway";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your ClutchLab account.",
};

// Session-dependent: render per-request, never bake auth state into static HTML.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/profile");

  return (
    <div className="mx-auto max-w-sm space-y-4 py-6">
      <MockModeBanner />
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Your profiles, calibrations, and training history.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <OAuthButtons />
          <CredentialsForm
            action={signInAction}
            submitLabel="Sign in"
            alternate={{ text: "New to ClutchLab?", href: "/signup", linkLabel: "Create an account" }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
