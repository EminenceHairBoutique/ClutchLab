import { Badge, Card, CardContent, CardHeader, CardTitle } from "@clutchlab/ui";
import Link from "next/link";

import { daysUntil, formatDate } from "@/lib/dates";
import { getMetaStore } from "@/lib/data/meta-store";

import { ConfidenceBadge, StatusBadge } from "./badges";
import { ProvenanceNote } from "./provenance-note";

const SEASON_KIND_LABEL: Record<string, string> = {
  classic: "Classic Season",
  casual: "Casual Season",
  ultimate_royale: "Ultimate Royale",
  ranked_arena: "Ranked Arena",
  metro: "Metro Royale",
  other: "Event",
};

/** Home version & season intelligence (spec §5.2 slice for Phase 2). */
export async function VersionIntelCard() {
  const store = await getMetaStore();
  const intel = await store.getVersionIntel();

  if (!intel.version) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No version data published yet</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const weaponChanges = intel.changes.filter((c) => c.area === "weapon");

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>PUBG Mobile Version {intel.version.version}</CardTitle>
            <StatusBadge status={intel.version.dataStatus} />
            <ConfidenceBadge level={intel.version.confidence} />
          </div>
          <p className="text-sm text-muted">
            Released {formatDate(intel.version.releasedOn)} · window to{" "}
            {formatDate(intel.version.windowEnd)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {intel.version.headline && (
            <p className="text-sm text-muted">{intel.version.headline}</p>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {intel.seasons.map((season) => {
              const remaining = daysUntil(season.endsAt);
              return (
                <div key={season.slug} className="rounded-md border border-border bg-surface-raised p-3">
                  <p className="text-xs text-muted">
                    {SEASON_KIND_LABEL[season.kind] ?? season.kind}
                  </p>
                  <p className="font-semibold">{season.name}</p>
                  <p className="text-xs text-muted">
                    {formatDate(season.startsAt)} → {formatDate(season.endsAt)}
                  </p>
                  {remaining !== null && remaining > 0 && (
                    <p className="mt-1 font-mono text-xs tabular-nums text-accent">
                      {remaining} days left
                    </p>
                  )}
                  <div className="mt-1.5">
                    <ConfidenceBadge level={season.confidence} />
                  </div>
                </div>
              );
            })}
          </div>

          {weaponChanges.length > 0 && (
            <div>
              <p className="text-sm font-medium">Balance changes affecting weapons</p>
              <ul className="mt-1.5 space-y-1 text-sm text-muted">
                {weaponChanges.map((change) => (
                  <li key={change.summary} className="flex items-start gap-2">
                    <Badge variant={change.changeType === "buff" ? "success" : "outline"}>
                      {change.changeType}
                    </Badge>
                    <span>
                      {change.summary}{" "}
                      {change.targetSlug && (
                        <Link
                          href={`/weapons/${change.targetSlug}`}
                          className="text-accent hover:underline"
                        >
                          details
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {intel.version.sourceName && (
            <p className="text-xs text-faint">
              Source: {intel.version.sourceName} — full research log in DATA_VERIFICATION.md.
            </p>
          )}
        </CardContent>
      </Card>
      <ProvenanceNote provenance={intel.provenance} />
    </div>
  );
}
