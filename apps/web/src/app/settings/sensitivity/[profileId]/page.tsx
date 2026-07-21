import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { rollbackAction } from "@/app/settings/actions";
import { MockModeBanner } from "@/components/auth/mock-mode-banner";
import { CodeForm } from "@/components/settings/code-form";
import { ValuesEditor } from "@/components/settings/values-editor";
import { getSessionUser } from "@/lib/auth/gateway";
import { getSensitivityStore } from "@/lib/data/sensitivity-store";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Sensitivity profile" };

export const dynamic = "force-dynamic";

interface ProfilePageProps {
  params: Promise<{ profileId: string }>;
}

export default async function SensitivityProfilePage({ params }: ProfilePageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { profileId } = await params;
  const profile = await getSensitivityStore().getProfile(user.id, profileId);
  if (!profile) notFound();

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/settings/sensitivity" className="hover:text-accent">
          Sensitivity builder
        </Link>{" "}
        / {profile.name}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
        <Button asChild variant="accent">
          <Link href={`/settings/sensitivity/${profile.id}/calibrate`}>Start guided calibration</Link>
        </Button>
      </div>
      <MockModeBanner />

      <Card>
        <CardHeader>
          <CardTitle>Values</CardTitle>
          <CardDescription>
            1–300 per slot. Saving never overwrites — it creates the next version below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ValuesEditor profileId={profile.id} values={profile.activeValues} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Version history</CardTitle>
          <CardDescription>Immutable — roll back by creating a new version from an old one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {profile.versions.map((version) => (
            <div
              key={version.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm"
            >
              <span className="font-mono font-semibold">v{version.versionNo}</span>
              {version.isActive && <Badge variant="accent">active</Badge>}
              <Badge variant="outline">{version.origin}</Badge>
              <span className="text-muted">{version.note ?? "—"}</span>
              <span className="ml-auto text-xs text-faint">{formatDate(version.createdAt)}</span>
              {!version.isActive && (
                <form action={rollbackAction}>
                  <input type="hidden" name="profileId" value={profile.id} />
                  <input type="hidden" name="versionId" value={version.id} />
                  <input type="hidden" name="versionNo" value={version.versionNo} />
                  <Button type="submit" size="sm" variant="outline">
                    Roll back to this
                  </Button>
                </form>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Share codes</CardTitle>
          <CardDescription>Your own codes, stored verbatim as artifacts of this profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile.codes.length > 0 && (
            <ul className="space-y-1.5">
              {profile.codes.map((code) => (
                <li
                  key={code.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm"
                >
                  <Badge variant="outline">{code.kind}</Badge>
                  <code className="font-mono text-xs">{code.code}</code>
                  {code.label && <span className="text-xs text-muted">{code.label}</span>}
                </li>
              ))}
            </ul>
          )}
          <CodeForm profileId={profile.id} />
        </CardContent>
      </Card>
    </div>
  );
}
