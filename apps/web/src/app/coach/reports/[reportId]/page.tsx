import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { reviewReportAction } from "@/app/admin/coach/actions";
import { getSessionUser } from "@/lib/auth/gateway";
import { checkRoleAtLeast } from "@/lib/auth/roles";
import { getCoachStore } from "@/lib/data/coach-store";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Coaching report" };

export const dynamic = "force-dynamic";

function timestamp(tSeconds: number): string {
  const m = Math.floor(tSeconds / 60);
  const s = tSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const REVIEW_BADGE: Record<string, { label: string; variant: "warning" | "success" | "danger" }> = {
  pending_review: { label: "pending human spot-check", variant: "warning" },
  published: { label: "human spot-checked", variant: "success" },
  rejected: { label: "rejected by review", variant: "danger" },
};

export default async function CoachReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const isEditor = await checkRoleAtLeast(user, "editor");
  const report = await getCoachStore().getReport({ userId: user.id, isEditor }, reportId);
  if (!report) notFound();

  const review = REVIEW_BADGE[report.reviewStatus] ?? null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Coaching report</h1>
          {review && <Badge variant={review.variant}>{review.label}</Badge>}
          <Badge variant="outline">confidence: {report.confidence}</Badge>
        </div>
        <p className="text-sm text-muted">
          {report.uploadLabel ? (
            <>
              {report.uploadKindLabel} · <span className="font-medium">{report.uploadLabel}</span> ·{" "}
            </>
          ) : null}
          {formatDate(report.createdAt)}
        </p>
      </div>

      {isEditor && report.reviewStatus === "pending_review" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Editorial spot-check</CardTitle>
            <CardDescription>
              You are reviewing as an editor. Publish if the report meets the honesty bar; reject
              if it overclaims or misreads the evidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <form action={reviewReportAction}>
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="decision" value="published" />
              <Button type="submit" size="sm" variant="accent">
                Publish
              </Button>
            </form>
            <form action={reviewReportAction}>
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="decision" value="rejected" />
              <Button type="submit" size="sm" variant="destructive">
                Reject
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Executive summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{report.executiveSummary}</p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Highest-impact mistakes</h2>
        {report.mistakes.map((mistake, index) => (
          <Card key={`${mistake.tSeconds}-${index}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-accent">{timestamp(mistake.tSeconds)}</span>
                <CardTitle className="text-sm">{mistake.what}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p>
                <span className="font-medium text-muted">Why it mattered: </span>
                {mistake.whyItMattered}
              </p>
              <p>
                <span className="font-medium text-muted">Better alternative: </span>
                {mistake.betterAlternative}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {report.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assigned drills</CardTitle>
            <CardDescription>Practice what the review actually found.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.recommendations.map((rec) => (
              <div key={rec.drillSlug} className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/training/drills/${rec.drillSlug}`}>{rec.drillName}</Link>
                </Button>
                <span className="text-xs text-muted">{rec.reason}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {report.settingsNote && (
        <Card>
          <CardHeader>
            <CardTitle>Settings note</CardTitle>
            <CardDescription>
              Suggested only because a repeated pattern supports it — never from a single miss.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{report.settingsNote}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What the model could not determine</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">{report.couldNotDetermine}</p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Observation timeline</h2>
        <p className="text-xs text-muted">
          Raw per-moment observations, stored separately so reports can be regenerated when prompts
          improve. Inferred lines are marked — they are conclusions, not direct visual evidence.
        </p>
        {report.observations.map((obs, index) => (
          <div
            key={`${obs.tSeconds}-${index}`}
            className="flex flex-wrap items-baseline gap-2 rounded-md border border-border px-3 py-2"
          >
            <span className="font-mono text-xs text-accent">{timestamp(obs.tSeconds)}</span>
            <Badge variant="outline">{obs.category.replace(/_/g, " ")}</Badge>
            {obs.inference && <Badge variant="warning">inferred</Badge>}
            <span className="text-sm">{obs.observation}</span>
          </div>
        ))}
      </div>

      <p className="font-mono text-xs text-faint">
        model: {report.modelId} · prompt: {report.promptVersion}
      </p>

      <Button asChild variant="outline">
        <Link href="/coach">Back to recordings</Link>
      </Button>
    </div>
  );
}
