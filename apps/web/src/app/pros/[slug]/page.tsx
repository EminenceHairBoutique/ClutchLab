import {
  FAMILY_LABEL,
  SCOPE_LABEL,
  type SensitivityFamily,
  type SensitivityScope,
} from "@clutchlab/calibration";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Stat, cn } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProvenanceNote } from "@/components/meta/provenance-note";
import { VerificationBadge } from "@/components/pros/verification-badge";
import { getSessionUser } from "@/lib/auth/gateway";
import { getProStore } from "@/lib/data/pro-store";
import { getSensitivityStore } from "@/lib/data/sensitivity-store";

import { forkProAction } from "../actions";

export const dynamic = "force-dynamic";

interface ProPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ compare?: string }>;
}

export async function generateMetadata({ params }: ProPageProps): Promise<Metadata> {
  const { slug } = await params;
  const pro = await getProStore().getPro(slug);
  return { title: pro ? `${pro.displayName} settings` : "Profile not found" };
}

function splitKey(key: string): { family: SensitivityFamily; scope: SensitivityScope | null } {
  const [family, scope] = key.split(":");
  return {
    family: family as SensitivityFamily,
    scope: scope === "-" ? null : (scope as SensitivityScope),
  };
}

export default async function ProPage({ params, searchParams }: ProPageProps) {
  const { slug } = await params;
  const { compare } = await searchParams;
  const store = getProStore();
  const pro = await store.getPro(slug);
  if (!pro) notFound();

  const user = await getSessionUser();
  const myProfiles = user ? await getSensitivityStore().listProfiles(user.id) : [];
  const compareProfile =
    user && compare ? await getSensitivityStore().getProfile(user.id, compare) : null;

  const facts: Array<[string, string | null]> = [
    ["Team", pro.teamName],
    ["Region", pro.region],
    ["Role", pro.role],
    ["Device", pro.deviceLabel],
    ["FPS", pro.fpsTier],
    ["Fingers", pro.fingerCount ? `${pro.fingerCount}` : null],
    ["Grip", pro.gripStyle],
    ["Gyro", pro.gyroMode],
    ["Aim assist", pro.aimAssist],
    ["Game version", pro.gameVersionLabel],
  ];

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/pros" className="hover:text-accent">
          Pros
        </Link>{" "}
        / {pro.displayName}
      </nav>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{pro.displayName}</h1>
          <VerificationBadge level={pro.verification} />
          {pro.isStale && <Badge variant="danger">stale — review required</Badge>}
        </div>
        {pro.notes && <p className="max-w-2xl text-sm text-warning">{pro.notes}</p>}
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-5">
          {facts
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-faint">{label}</p>
                <p className="text-sm text-foreground">{value}</p>
              </div>
            ))}
        </CardContent>
      </Card>

      <p className="rounded-md border border-info/40 bg-info/10 px-3 py-2 text-sm text-info">
        Settings rarely transfer 1:1 — screen size, touch sampling, FPS, and grip all change how a
        number feels. Fork these values as a starting point, then run guided calibration on your
        own device.
      </p>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Sensitivity values</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {user && myProfiles.length > 0 && (
                <form method="get" className="flex items-center gap-2">
                  <label htmlFor="compare" className="text-xs text-muted">
                    Compare with
                  </label>
                  <select
                    id="compare"
                    name="compare"
                    defaultValue={compare ?? ""}
                    className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                  >
                    <option value="">—</option>
                    {myProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="outline">
                    Compare
                  </Button>
                </form>
              )}
              {user ? (
                <form action={forkProAction}>
                  <input type="hidden" name="proSlug" value={pro.slug} />
                  <Button type="submit" size="sm" variant="accent">
                    Fork as my profile
                  </Button>
                </form>
              ) : (
                <Button asChild size="sm" variant="accent">
                  <Link href="/login">Sign in to fork</Link>
                </Button>
              )}
            </div>
          </div>
          {compareProfile && (
            <CardDescription>
              Comparing against <strong>{compareProfile.name}</strong> (your active version).
              Differences show as your value → {pro.displayName}&apos;s.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2 pr-4 font-medium">Slot</th>
                  <th className="py-2 pr-4 font-medium">{pro.displayName}</th>
                  {compareProfile && <th className="py-2 pr-4 font-medium">You</th>}
                  {compareProfile && <th className="py-2 font-medium">Δ</th>}
                </tr>
              </thead>
              <tbody>
                {Object.entries(pro.values).map(([key, value]) => {
                  const { family, scope } = splitKey(key);
                  const mine = compareProfile?.activeValues[key];
                  const delta = mine !== undefined ? value - mine : null;
                  return (
                    <tr key={key} className="border-b border-border/50">
                      <td className="py-1.5 pr-4 text-muted">
                        {FAMILY_LABEL[family]} · {scope ? SCOPE_LABEL[scope] : "—"}
                      </td>
                      <td className="py-1.5 pr-4">
                        <Stat value={value} />
                      </td>
                      {compareProfile && (
                        <td className="py-1.5 pr-4">{mine !== undefined ? <Stat value={mine} /> : <span className="text-faint">not set</span>}</td>
                      )}
                      {compareProfile && (
                        <td
                          className={cn(
                            "py-1.5 font-mono tabular-nums",
                            delta === null ? "text-faint" : delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted",
                          )}
                        >
                          {delta === null ? "—" : delta > 0 ? `+${delta}` : `${delta}`}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {pro.preferredWeapons.length > 0 && (
        <p className="text-sm text-muted">
          Preferred weapons:{" "}
          {pro.preferredWeapons.map((w, i) => (
            <span key={w}>
              {i > 0 && ", "}
              <Link href={`/weapons/${w}`} className="text-accent hover:underline">
                {w}
              </Link>
            </span>
          ))}
        </p>
      )}

      <ProvenanceNote provenance={store.provenance} />
    </div>
  );
}
