import { Card, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Enums } from "@clutchlab/types";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@clutchlab/ui";

import { AvailabilityBadge, StatusBadge, WEAPON_CLASS_LABEL } from "@/components/meta/badges";
import { ProvenanceNote } from "@/components/meta/provenance-note";
import { getMetaStore } from "@/lib/data/meta-store";

export const metadata: Metadata = {
  title: "Weapons",
  description:
    "The PUBG Mobile 4.5 weapon catalog with classes, availability, patch notes, and verification status.",
};

export const dynamic = "force-dynamic";

const CLASS_ORDER: Enums<"weapon_class">[] = [
  "ar",
  "smg",
  "dmr",
  "sr",
  "shotgun",
  "lmg",
  "pistol",
  "other",
];

export default async function WeaponsPage() {
  const store = await getMetaStore();
  const weapons = await store.listWeapons();
  const groups = CLASS_ORDER.map((cls) => ({
    cls,
    weapons: weapons.filter((w) => w.weaponClass === cls),
  })).filter((g) => g.weapons.length > 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Weapons</h1>
        <p className="text-sm text-muted">
          Version 4.5 catalog. Numeric stats appear only once verified — no invented numbers,
          ever.
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.cls} aria-label={WEAPON_CLASS_LABEL[group.cls]} className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">
            {WEAPON_CLASS_LABEL[group.cls]}
            <span className="ml-2 text-sm font-normal text-muted">{group.weapons.length}</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.weapons.map((w) => (
              <Link key={w.slug} href={`/weapons/${w.slug}`} className="group">
                <Card className="h-full transition-colors group-hover:border-border-strong">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="group-hover:text-accent">{w.name}</CardTitle>
                      <AvailabilityBadge kind={w.availability} />
                    </div>
                    <CardDescription>{w.description}</CardDescription>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <StatusBadge status={w.dataStatus} />
                      {w.changeNote && <Badge variant="warning">4.5 change</Badge>}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <ProvenanceNote provenance={store.provenance} />
    </div>
  );
}
