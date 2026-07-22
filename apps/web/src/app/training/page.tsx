import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Stat } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { ProvenanceNote } from "@/components/meta/provenance-note";
import { getSessionUser } from "@/lib/auth/gateway";
import {
  catalogProvenance,
  getTrainingUserStore,
  listDrillViews,
  listPlanRecords,
  listWowRecords,
} from "@/lib/data/training-store";

export const metadata: Metadata = {
  title: "Training",
  description: "Structured PUBG Mobile drills, daily plans, and measurable progress tracking.",
};

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  aim: "Aim fundamentals",
  recoil: "Recoil",
  close_range: "Close range",
  mid_range: "Mid range",
  long_range: "Long range",
  movement: "Movement",
  audio: "Audio",
  throwables: "Throwables",
  br_intelligence: "Battle royale IQ",
  team_play: "Team play",
};

export default async function TrainingPage() {
  const user = await getSessionUser();
  const drills = listDrillViews();
  const plans = listPlanRecords();
  const wowMaps = listWowRecords();
  const summary = user ? await getTrainingUserStore().weeklySummary(user.id) : null;

  const categories = [...new Set(drills.map((d) => d.category))].map((category) => ({
    category,
    count: drills.filter((d) => d.category === category).length,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Training</h1>
        <p className="text-sm text-muted">
          {drills.length} deliberate-practice drills. Consistency and transfer beat volume — every
          drill has a pass bar, not a participation trophy.
        </p>
      </div>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Your last 7 days</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-2xl font-bold"><Stat value={summary.sessionsCompleted} /></p>
              <p className="text-xs text-muted">sessions completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold"><Stat value={summary.minutesCompleted} unit="min" /></p>
              <p className="text-xs text-muted">deliberate minutes</p>
            </div>
            <div>
              <p className="text-2xl font-bold"><Stat value={summary.drillsLogged} /></p>
              <p className="text-xs text-muted">drill results logged</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {summary.passRate !== null ? <Stat value={summary.passRate} unit="%" /> : "—"}
              </p>
              <p className="text-xs text-muted">pass rate</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-accent/40">
        <CardHeader>
          <CardTitle>Generate today&apos;s plan</CardTitle>
          <CardDescription>
            Pick a time budget and focus — the generator fills it from the drill catalog, spreading
            skills and preferring what you haven&apos;t mastered.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" action="/training/generate" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor="gen-minutes" className="text-sm font-medium">Minutes</label>
              <select id="gen-minutes" name="minutes" defaultValue="15"
                className="flex h-10 rounded-md border border-border bg-surface px-3 text-sm">
                {[5, 10, 15, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>{m} minutes</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="gen-focus" className="text-sm font-medium">Focus</label>
              <select id="gen-focus" name="focus" defaultValue=""
                className="flex h-10 rounded-md border border-border bg-surface px-3 text-sm">
                <option value="">Balanced (all skills)</option>
                {categories.map((c) => (
                  <option key={c.category} value={c.category}>{CATEGORY_LABEL[c.category] ?? c.category}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="gen-aa" className="text-sm font-medium">Aim assist</label>
              <select id="gen-aa" name="aa" defaultValue="mixed"
                className="flex h-10 rounded-md border border-border bg-surface px-3 text-sm">
                <option value="mixed">Mixed</option>
                <option value="on">On (Classic focus)</option>
                <option value="off">Off (Ultimate Royale prep)</option>
              </select>
            </div>
            <Button type="submit" variant="accent">Generate</Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="plans-heading" className="space-y-2">
        <h2 id="plans-heading" className="text-lg font-semibold tracking-tight">Curated plans</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Link key={plan.slug} href={`/training/plans/${plan.slug}`} className="group">
              <Card className="h-full transition-colors group-hover:border-border-strong">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="group-hover:text-accent">{plan.name}</CardTitle>
                    <Badge variant="outline">{plan.minutes} min</Badge>
                    {plan.aimAssistFocus === "off" && <Badge variant="warning">AA off</Badge>}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="skills-heading" className="space-y-2">
        <h2 id="skills-heading" className="text-lg font-semibold tracking-tight">Drill library</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <Card key={c.category}>
              <CardContent className="p-3">
                <p className="text-sm font-medium">{CATEGORY_LABEL[c.category] ?? c.category}</p>
                <p className="text-xs text-muted">{c.count} drills</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <details className="rounded-lg border border-border bg-surface">
          <summary className="cursor-pointer select-none p-3 text-sm font-medium">
            Browse all {drills.length} drills
          </summary>
          <ul className="grid grid-cols-1 gap-1 border-t border-border p-3 sm:grid-cols-2">
            {drills.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/training/drills/${d.slug}`}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-raised"
                >
                  <span>{d.name}</span>
                  <span className="text-xs text-faint">{d.durationMinutes}m · {d.difficulty}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section aria-labelledby="wow-heading" className="space-y-2">
        <h2 id="wow-heading" className="text-lg font-semibold tracking-tight">
          World of Wonder directory
        </h2>
        <p className="text-xs text-faint">
          Map codes appear only after editorial verification — codes expire, so none are shown
          until confirmed current.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {wowMaps.map((map) => (
            <Card key={map.slug}>
              <CardHeader className="p-3">
                <CardTitle className="text-sm">{map.name}</CardTitle>
                <CardDescription className="text-xs">
                  {map.category} · {map.playerCount ?? "?"} players · {map.rules}
                </CardDescription>
                <Badge variant="outline">code pending verification</Badge>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <ProvenanceNote provenance={catalogProvenance()} />
    </div>
  );
}
