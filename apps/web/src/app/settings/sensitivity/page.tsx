import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { MockModeBanner } from "@/components/auth/mock-mode-banner";
import { CreateProfileForm } from "@/components/settings/create-profile-form";
import { getSessionUser } from "@/lib/auth/gateway";
import { getSensitivityStore } from "@/lib/data/sensitivity-store";

export const metadata: Metadata = {
  title: "Sensitivity builder",
  description: "Named sensitivity profiles with version history, rollback, and guided calibration.",
};

export const dynamic = "force-dynamic";

export default async function SensitivityPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Sensitivity builder</h1>
        <MockModeBanner />
        <Card>
          <CardHeader>
            <CardTitle>Sign in to build profiles</CardTitle>
            <CardDescription>
              Profiles, version history, calibration results, and codes are saved to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild variant="accent">
              <Link href="/signup">Create account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profiles = await getSensitivityStore().listProfiles(user.id);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Sensitivity builder</h1>
        <p className="text-sm text-muted">
          Every save is a new version — nothing is overwritten, everything can be rolled back.
        </p>
      </div>
      <MockModeBanner />

      <Card>
        <CardContent className="pt-4">
          <CreateProfileForm />
        </CardContent>
      </Card>

      <div className="space-y-2">
        {profiles.length === 0 && (
          <p className="text-sm text-muted">No profiles yet — create your first one above.</p>
        )}
        {profiles.map((profile) => (
          <Link key={profile.id} href={`/settings/sensitivity/${profile.id}`} className="block">
            <Card className="transition-colors hover:border-border-strong">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{profile.name}</CardTitle>
                  {profile.activeVersionNo !== null && (
                    <Badge variant="accent">v{profile.activeVersionNo} active</Badge>
                  )}
                  <Badge variant="outline">
                    {profile.versionCount} version{profile.versionCount === 1 ? "" : "s"}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
