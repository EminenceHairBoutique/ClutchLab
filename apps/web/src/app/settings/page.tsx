import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { ProvenanceNote } from "@/components/meta/provenance-note";
import { listSettingExplainers } from "@/lib/data/settings-store";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "PUBG Mobile settings explained: what each does, what it doesn't, and honest recommendations.",
};

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  aiming: "Aiming",
  controls: "Controls",
  gyroscope: "Gyroscope",
  graphics: "Graphics & performance",
  audio: "Audio",
  gameplay: "Gameplay",
  accessibility: "Accessibility",
};

export default async function SettingsPage() {
  const { provenance, explainers } = await listSettingExplainers();
  const categories = [...new Set(explainers.map((e) => e.category))];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">
          {explainers.length} settings explained — what each does, what it doesn&apos;t, and when
          to retest. No setting is ever promised to fix your aim.
        </p>
      </div>

      <Card className="border-accent/40">
        <CardHeader>
          <CardTitle>Personalized sensitivity builder</CardTitle>
          <CardDescription>
            Named profiles with immutable version history, rollback, verbatim code storage, and
            the 14-step guided calibration that changes one variable at a time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="accent">
            <Link href="/settings/sensitivity">Open the builder</Link>
          </Button>
        </CardContent>
      </Card>

      {categories.map((category) => (
        <section key={category} aria-label={CATEGORY_LABEL[category]} className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">{CATEGORY_LABEL[category]}</h2>
          <div className="space-y-2">
            {explainers
              .filter((e) => e.category === category)
              .map((setting) => (
                <details key={setting.slug} className="rounded-lg border border-border bg-surface">
                  <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 p-3 text-sm font-medium">
                    {setting.name}
                    {setting.retestAfterUpdate && (
                      <Badge variant="warning">retest after updates</Badge>
                    )}
                  </summary>
                  <div className="space-y-2 border-t border-border p-3 text-sm text-muted">
                    <p>
                      <strong className="text-foreground">What it does: </strong>
                      {setting.whatItDoes}
                    </p>
                    {setting.whatItDoesNot && (
                      <p>
                        <strong className="text-foreground">What it doesn&apos;t: </strong>
                        {setting.whatItDoesNot}
                      </p>
                    )}
                    {setting.advantages && (
                      <p>
                        <strong className="text-success">Pros: </strong>
                        {setting.advantages}
                      </p>
                    )}
                    {setting.disadvantages && (
                      <p>
                        <strong className="text-danger">Cons: </strong>
                        {setting.disadvantages}
                      </p>
                    )}
                    {setting.beginnerRec && (
                      <p>
                        <strong className="text-foreground">Beginner: </strong>
                        {setting.beginnerRec}
                      </p>
                    )}
                    {setting.competitiveRec && (
                      <p>
                        <strong className="text-foreground">Competitive: </strong>
                        {setting.competitiveRec}
                      </p>
                    )}
                    {setting.modeNotes && (
                      <p>
                        <strong className="text-foreground">Mode notes: </strong>
                        {setting.modeNotes}
                      </p>
                    )}
                    {setting.deviceImpact && (
                      <p>
                        <strong className="text-foreground">Device impact: </strong>
                        {setting.deviceImpact}
                      </p>
                    )}
                  </div>
                </details>
              ))}
          </div>
        </section>
      ))}

      <ProvenanceNote provenance={provenance} />
    </div>
  );
}
