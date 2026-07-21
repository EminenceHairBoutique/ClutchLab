import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your device, mechanics profile, and saved setups.",
};

/**
 * Placeholder until the auth step of Phase 1 wires this to real sessions.
 * Replaced in the same phase — see PROGRESS.md.
 */
export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <Badge variant="outline">Phase 1 · auth wiring in progress</Badge>
        </div>
        <p className="text-sm text-muted">
          Your device, mechanics profile, and saved setups will live here.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sign-in arrives with the next Phase 1 milestone</CardTitle>
          <CardDescription>
            Email/password authentication, your player profile, and the device knowledge base
            picker are being wired to the database right now.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          Until then, everything else in ClutchLab is browsable as a guest.
        </CardContent>
      </Card>
    </div>
  );
}
