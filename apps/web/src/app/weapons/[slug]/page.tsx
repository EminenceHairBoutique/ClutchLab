import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Stat,
  TierBadge,
  cn,
} from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AvailabilityBadge,
  ConfidenceBadge,
  StatusBadge,
  WEAPON_CLASS_LABEL,
} from "@/components/meta/badges";
import { ProvenanceNote } from "@/components/meta/provenance-note";
import { getMetaStore } from "@/lib/data/meta-store";

export const dynamic = "force-dynamic";

interface WeaponPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: WeaponPageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await getMetaStore();
  const weapon = await store.getWeaponDetail(slug);
  if (!weapon) return { title: "Weapon not found" };
  return {
    title: `${weapon.name} — PUBG Mobile 4.5`,
    description: weapon.description ?? `${weapon.name} details, tiers, and attachments.`,
  };
}

const MODE_LABEL: Record<string, string> = {
  classic_ranked: "Classic Ranked",
  ultimate_royale: "Ultimate Royale",
};

const AMMO_LABEL: Record<string, string> = {
  "556": "5.56mm",
  "762": "7.62mm",
  "9mm": "9mm",
  "45acp": ".45 ACP",
  "12gauge": "12 gauge",
  "300magnum": ".300 Magnum",
  bolt: "Bolt",
  other: "Special",
};

export default async function WeaponPage({ params }: WeaponPageProps) {
  const { slug } = await params;
  const store = await getMetaStore();
  const weapon = await store.getWeaponDetail(slug);
  if (!weapon) notFound();

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/weapons" className="hover:text-accent">
          Weapons
        </Link>{" "}
        / {weapon.name}
      </nav>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{weapon.name}</h1>
          <Badge>{WEAPON_CLASS_LABEL[weapon.weaponClass]}</Badge>
          <Badge variant="outline">{AMMO_LABEL[weapon.ammo] ?? weapon.ammo}</Badge>
          <AvailabilityBadge kind={weapon.availability} />
        </div>
        <p className="max-w-2xl text-sm text-muted">{weapon.description}</p>
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={weapon.dataStatus} />
          <ConfidenceBadge level={weapon.confidence} />
          {weapon.fireModes.length > 0 && (
            <Badge variant="outline">fire: {weapon.fireModes.join(" / ")}</Badge>
          )}
        </div>
        {weapon.notes && <p className="text-xs text-faint">{weapon.notes}</p>}
      </div>

      {weapon.changeNote && (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="text-warning">Version 4.5 change</CardTitle>
            <CardDescription>{weapon.changeNote}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {weapon.impacts.length > 0 && (
        <div className="space-y-2">
          {weapon.impacts.map((impact, index) => (
            <p
              key={index}
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                impact.impact === "retest_required"
                  ? "border-danger/40 bg-danger/10 text-danger"
                  : "border-info/40 bg-info/10 text-info",
              )}
            >
              <strong className="font-semibold">
                {impact.impact === "retest_required" ? "Retest required: " : "Review recommended: "}
              </strong>
              {impact.note}
            </p>
          ))}
        </div>
      )}

      <section aria-labelledby="tiers-heading" className="space-y-3">
        <h2 id="tiers-heading" className="text-lg font-semibold tracking-tight">
          Current tiers
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {weapon.tiers.map((tier) => (
            <Card key={tier.modeSlug}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <TierBadge tier={tier.tier} />
                  <div>
                    <CardTitle>{MODE_LABEL[tier.modeSlug] ?? tier.modeSlug}</CardTitle>
                    {tier.score !== null && (
                      <span className="text-sm text-muted">
                        <Stat value={tier.score} />
                        <span className="text-xs text-faint">/100</span>
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer select-none text-faint hover:text-muted">
                    Score breakdown · {tier.confidence} confidence
                  </summary>
                  <ul className="mt-2 space-y-1 border-l border-border pl-3">
                    {tier.breakdown.map((line) => (
                      <li key={line.label} className="flex items-baseline justify-between gap-3">
                        <span>{line.label}</span>
                        <span
                          className={cn(
                            "font-mono tabular-nums",
                            line.points < 0 ? "text-danger" : "text-foreground",
                          )}
                        >
                          {line.points >= 0 ? "+" : ""}
                          {line.points.toFixed(1)}
                        </span>
                      </li>
                    ))}
                    {tier.evidenceNote && <li className="pt-1 text-faint">{tier.evidenceNote}</li>}
                  </ul>
                </details>
              </CardContent>
            </Card>
          ))}
          {weapon.tiers.length === 0 && (
            <p className="text-sm text-muted">No published tier data for this weapon yet.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="stats-heading" className="space-y-3">
        <h2 id="stats-heading" className="text-lg font-semibold tracking-tight">
          Measured stats
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Not yet verified</CardTitle>
            <CardDescription>
              Damage, rate of fire, and velocity numbers appear here only once they come from
              official notes or reproducible measurements. ClutchLab does not invent statistics —
              an editorial review task is open for 4.5 weapon data.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section aria-labelledby="attachments-heading" className="space-y-3">
        <h2 id="attachments-heading" className="text-lg font-semibold tracking-tight">
          Compatible attachment types
        </h2>
        <p className="text-xs text-faint">
          Class-level compatibility with qualitative effects. Per-weapon slot matrices and the
          attachment simulator arrive with the Attachment Lab.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {weapon.attachments.map((attachment) => (
            <Card key={attachment.slug}>
              <CardHeader className="p-3">
                <CardTitle className="text-sm">{attachment.name}</CardTitle>
                <CardDescription className="text-xs">
                  {attachment.effects
                    .map((e) => `${e.key.replaceAll("_", " ")}: ${e.direction} (${e.magnitude})`)
                    .join(" · ")}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <ProvenanceNote provenance={store.provenance} />
    </div>
  );
}
