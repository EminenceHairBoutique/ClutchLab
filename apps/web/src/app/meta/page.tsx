import { Badge, cn } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { ProvenanceNote } from "@/components/meta/provenance-note";
import { TierBoardView } from "@/components/meta/tier-board";
import { getMetaStore } from "@/lib/data/meta-store";

export const metadata: Metadata = {
  title: "Meta",
  description:
    "PUBG Mobile weapon tiers scoped by mode and version, with explainable scores, confidence labels, and sources.",
};

export const dynamic = "force-dynamic";

interface MetaPageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function MetaPage({ searchParams }: MetaPageProps) {
  const params = await searchParams;
  const store = await getMetaStore();
  const modes = await store.listTierModes();
  const requested = params.mode;
  const activeMode =
    modes.find((m) => m.slug === requested)?.slug ?? modes[0]?.slug ?? "classic_ranked";
  const board = await store.getTierBoard(activeMode);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Meta</h1>
        <p className="text-sm text-muted">
          Version 4.5 · S31 weapon tiers, ranked per mode with the full scoring breakdown. Never
          one universal list.
        </p>
      </div>

      <nav aria-label="Mode" className="flex flex-wrap gap-2">
        {modes.map((mode) => (
          <Link
            key={mode.slug}
            href={`/meta?mode=${mode.slug}`}
            aria-current={mode.slug === activeMode ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              mode.slug === activeMode
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border text-muted hover:text-foreground",
            )}
          >
            {mode.name}
            {mode.aimAssistAllowed === false && (
              <span className="ml-1.5 text-xs text-faint">no aim assist</span>
            )}
          </Link>
        ))}
      </nav>

      {board ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge variant="outline">
              methodology {board.methodology?.slug} v{board.methodology?.version}
            </Badge>
            <Badge variant="outline">availability-adjusted</Badge>
            {board.snapshotSlug && <span>snapshot: {board.snapshotSlug}</span>}
          </div>
          {board.snapshotNotes && <p className="text-xs text-faint">{board.snapshotNotes}</p>}
          <TierBoardView board={board} />
          <ProvenanceNote provenance={board.provenance} />
        </>
      ) : (
        <p className="rounded-md border border-border bg-surface px-3 py-4 text-sm text-muted">
          No published tier snapshot is available yet for this mode.
        </p>
      )}
    </div>
  );
}
