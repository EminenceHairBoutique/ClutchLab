import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CredentialsForm } from "@/components/auth/credentials-form";
import { MockModeBanner } from "@/components/auth/mock-mode-banner";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { signUpAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/gateway";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your ClutchLab account.",
};

// Session-dependent: render per-request, never bake auth state into static HTML.
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/profile");

  return (
    <div className="mx-auto max-w-sm space-y-4 py-6">
      <MockModeBanner />
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Free to start: one saved sensitivity profile, basic drills, and the current-version
            summary.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <OAuthButtons />
          <CredentialsForm
            action={signUpAction}
            submitLabel="Create account"
            alternate={{ text: "Already have an account?", href: "/login", linkLabel: "Sign in" }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
