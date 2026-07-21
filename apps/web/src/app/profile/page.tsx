import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { MockModeBanner } from "@/components/auth/mock-mode-banner";
import { ProfileForm } from "@/components/profile/profile-form";
import { signOutAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/gateway";
import { getProfileStore } from "@/lib/data/profile-store";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your device, mechanics profile, and saved setups.",
};

// Session-dependent: render per-request, never bake auth state into static HTML.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <MockModeBanner />
        <Card>
          <CardHeader>
            <CardTitle>You&apos;re browsing as a guest</CardTitle>
            <CardDescription>
              Create a free account to save your device, mechanics profile, sensitivity setups, and
              training history.
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

  const store = getProfileStore();
  const [profile, devices] = await Promise.all([store.getProfile(user.id), store.listDevices()]);

  return (
    <div className="space-y-4">
      <MockModeBanner />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-sm text-muted">
            Signed in as <span className="text-foreground">{user.email ?? user.id}</span>
          </p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Player setup</CardTitle>
            <Badge variant="accent">Phase 1</Badge>
          </div>
          <CardDescription>
            The basics that personalize everything else — device, grip, and preferences. The full
            onboarding wizard (screen size, FPS tier, touch sampling, roles, weaknesses) arrives
            with calibration in Phase 3.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            values={
              profile ?? {
                displayName: null,
                handle: null,
                region: null,
                fingerCount: null,
                gripStyle: null,
                gyroMode: null,
                aimAssistPref: null,
                primaryDeviceId: null,
              }
            }
            devices={devices}
          />
        </CardContent>
      </Card>
    </div>
  );
}
