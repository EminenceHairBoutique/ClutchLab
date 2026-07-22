import { Card, CardContent, Stat, TierBadge, cn } from "@clutchlab/ui";
import type { Enums } from "@clutchlab/types";
import Link from "next/link";

import type { TierBoard, TierEntry } from "@/lib/data/meta-store";

import { AvailabilityBadge, WEAPON_CLASS_LABEL } from "./badges";

const TIER_ORDER: Enums<"tier_letter">[] = ["S", "A", "B", "C", "D", "F"];

function RangeBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 text-muted">{label}</span>
      <div
        role="img"
        aria-label={`${label} range score ${value} of 100`}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised"
      >
        <div className="h-full rounded-full bg-accent/70" style={{ width: `${value}%` }} />
      </div>
      <span className="w-7 text-right font-mono tabular-nums text-muted">{value}</span>
    </div>
  );
}

function TierRow({ entry }: { entry: TierEntry }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <TierBadge tier={entry.tier} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/weapons/${entry.weaponSlug}`}
                className="font-semibold hover:text-accent"
              >
                {entry.weaponName}
              </Link>
              <span className="text-xs text-muted">{WEAPON_CLASS_LABEL[entry.weaponClass]}</span>
              <AvailabilityBadge kind={entry.availability} />
              {entry.score !== null && (
                <span className="ml-auto text-sm text-muted">
                  <Stat value={entry.score} />
                  <span className="text-xs text-faint">/100</span>
                </span>
              )}
            </div>
            {entry.rangeProfile && (
              <div className="grid max-w-md grid-cols-1 gap-1">
                <RangeBar label="Close" value={entry.rangeProfile.close} />
                <RangeBar label="Mid" value={entry.rangeProfile.mid} />
                <RangeBar label="Long" value={entry.rangeProfile.long} />
              </div>
            )}
            {entry.changeNote && (
              <p className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
                4.5: {entry.changeNote}
              </p>
            )}
            <details className="text-xs text-muted">
              <summary className="cursor-pointer select-none text-faint hover:text-muted">
                Why this tier · {entry.confidence} confidence · {entry.difficulty} difficulty
              </summary>
              <ul className="mt-2 space-y-1 border-l border-border pl-3">
                {entry.breakdown.map((line) => (
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
                {entry.evidenceNote && <li className="pt-1 text-faint">{entry.evidenceNote}</li>}
              </ul>
            </details>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TierBoardView({ board }: { board: TierBoard }) {
  const groups = TIER_ORDER.map((tier) => ({
    tier,
    entries: board.entries.filter((e) => e.tier === tier),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.tier} aria-label={`Tier ${group.tier}`} className="space-y-2">
          <div className="flex items-center gap-2">
            <TierBadge tier={group.tier} />
            <span className="text-sm text-muted">
              {group.entries.length} weapon{group.entries.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-2">
            {group.entries.map((entry) => (
              <TierRow key={entry.weaponSlug} entry={entry} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
