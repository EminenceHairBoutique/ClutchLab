import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LogResultForm } from "@/components/training/log-result-form";
import { getSessionUser } from "@/lib/auth/gateway";
import { getDrillRecord } from "@/lib/data/training-store";

export const dynamic = "force-dynamic";

interface DrillPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DrillPageProps): Promise<Metadata> {
  const { slug } = await params;
  const drill = getDrillRecord(slug);
  return { title: drill ? `${drill.name} — drill` : "Drill not found" };
}

export default async function DrillPage({ params }: DrillPageProps) {
  const { slug } = await params;
  const drill = getDrillRecord(slug);
  if (!drill) notFound();
  const user = await getSessionUser();
  const progression = drill.progressionSlug ? getDrillRecord(drill.progressionSlug) : null;

  const setup: Array<[string, string | null]> = [
    ["Mode", drill.requiredMode],
    ["Weapon", drill.weaponNote],
    ["Scope", drill.scopeNote],
    ["Distance", drill.distanceNote],
    ["Stance", drill.stanceNote],
    ["Duration", `${drill.durationMinutes} min`],
    ["Repetitions", drill.repetitions],
  ];

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/training" className="hover:text-accent">Training</Link> / {drill.name}
      </nav>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{drill.name}</h1>
          <Badge variant="outline">{drill.difficulty}</Badge>
          {drill.aimAssistVariant && <Badge variant="warning">aim assist {drill.aimAssistVariant}</Badge>}
        </div>
        <p className="text-sm text-muted">{drill.objective}</p>
        {drill.prerequisites && (
          <p className="text-xs text-faint">
            Prerequisite:{" "}
            <Link href={`/training/drills/${drill.prerequisites}`} className="text-accent hover:underline">
              {getDrillRecord(drill.prerequisites)?.name ?? drill.prerequisites}
            </Link>
          </p>
        )}
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
          {setup
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-faint">{label}</p>
                <p className="text-sm">{value}</p>
              </div>
            ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-success">Pass bar</CardTitle>
            <CardDescription>{drill.passingScore}</CardDescription>
          </CardHeader>
        </Card>
        {drill.advancedScore && (
          <Card>
            <CardHeader>
              <CardTitle className="text-accent">Advanced bar</CardTitle>
              <CardDescription>{drill.advancedScore}</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      {(drill.commonMistakes || drill.coachingCues) && (
        <Card>
          <CardContent className="space-y-2 pt-4 text-sm text-muted">
            {drill.commonMistakes && (
              <p>
                <strong className="text-danger">Common mistake: </strong>
                {drill.commonMistakes}
              </p>
            )}
            {drill.coachingCues && (
              <p>
                <strong className="text-foreground">Coaching cue: </strong>
                {drill.coachingCues}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {progression && (
        <p className="text-sm text-muted">
          Passed the advanced bar? Progress to{" "}
          <Link href={`/training/drills/${progression.slug}`} className="text-accent hover:underline">
            {progression.name}
          </Link>
          .
        </p>
      )}

      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Log a result</CardTitle>
            <CardDescription>Judge yourself against the pass bar — honest logs make honest reports.</CardDescription>
          </CardHeader>
          <CardContent>
            <LogResultForm drillSlug={drill.slug} sessionId={null} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
