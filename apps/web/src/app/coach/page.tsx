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

import { MockModeBanner } from "@/components/auth/mock-mode-banner";
import { UploadForm } from "@/components/coach/upload-form";
import { authMode, getSessionUser } from "@/lib/auth/gateway";
import { coachMode } from "@/lib/coach/gateway";
import { getCoachStore, type UploadView } from "@/lib/data/coach-store";
import { formatDate } from "@/lib/dates";

import { deleteUploadAction, markUploadedAction, requestAnalysisAction } from "./actions";

export const metadata: Metadata = {
  title: "AI Coach",
  description:
    "Post-match AI review of your uploaded recordings — timestamped, honest, actionable.",
};

export const dynamic = "force-dynamic";

function statusBadge(upload: UploadView): {
  label: string;
  variant: "outline" | "warning" | "success" | "danger";
} {
  if (upload.job?.status === "failed" || upload.status === "failed") {
    return { label: "analysis failed", variant: "danger" };
  }
  switch (upload.status) {
    case "registered":
      return { label: "awaiting recording", variant: "outline" };
    case "uploaded":
      return { label: "ready to analyze", variant: "outline" };
    case "queued":
    case "processing":
      return { label: "analyzing in background", variant: "warning" };
    case "complete":
      return { label: "report ready", variant: "success" };
    default:
      return { label: upload.status, variant: "outline" };
  }
}

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getSessionUser();
  const store = getCoachStore();
  const uploads = user ? await store.listUploads(user.id) : [];
  const quota = user ? await store.quota(user.id) : null;
  const mockProvider = coachMode() === "mock";
  const mockAuth = authMode() === "mock";

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">AI Coach</h1>
          <Button asChild size="sm" variant="outline">
            <Link href="/coach/marketplace">Human coach marketplace</Link>
          </Button>
        </div>
        <p className="text-sm text-muted">
          Post-match analysis of recordings you upload — never live assistance, overlays, or
          automation. Timestamped evidence, the three highest-impact mistakes, assigned drills, and
          an honest list of what the model could not determine.
        </p>
      </div>
      <MockModeBanner />
      {mockProvider && (
        <p
          role="status"
          className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
        >
          No AI provider configured (ANTHROPIC_API_KEY absent) — analyses use the built-in mock
          provider. Every mock artifact is labeled [MOCK] with confidence &quot;unverified&quot;.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {!user ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 pt-4">
            <p className="text-sm text-muted">Sign in to upload recordings and get coached.</p>
            <Button asChild variant="accent">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {quota !== null && quota.limit === 0 && (
            <Card className="border-accent/50">
              <CardHeader>
                <CardTitle className="text-sm">AI analysis is a Pro feature</CardTitle>
                <CardDescription>
                  You can register recordings now, but running an analysis needs a Pro plan
                  (10/month) or Elite (30/month, including full-match reviews).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="accent" size="sm">
                  <Link href="/billing">View plans</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Register a recording</CardTitle>
              <CardDescription>
                {quota
                  ? `Analyses this month: ${quota.used} of ${quota.limit} used (${quota.remaining} left). `
                  : ""}
                Screen recordings and screenshots you captured yourself — analysis starts only
                after the match is over.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadForm />
            </CardContent>
          </Card>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Your recordings</h2>
            {uploads.length === 0 && (
              <p className="text-sm text-muted">Nothing registered yet — add your first clip above.</p>
            )}
            {uploads.map((upload) => {
              const badge = statusBadge(upload);
              return (
                <Card key={upload.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{upload.kindLabel}</Badge>
                      <CardTitle className="text-sm">{upload.label}</CardTitle>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      <span className="ml-auto text-xs text-faint">
                        {upload.durationSeconds ? `${upload.durationSeconds}s · ` : ""}
                        {formatDate(upload.createdAt)}
                      </span>
                    </div>
                    {upload.job?.error && (
                      <CardDescription className="text-danger">{upload.job.error}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    {upload.status === "registered" && (
                      <form action={markUploadedAction}>
                        <input type="hidden" name="uploadId" value={upload.id} />
                        <Button type="submit" size="sm" variant="accent">
                          {mockAuth ? "Attach recording (simulated)" : "Mark storage upload done"}
                        </Button>
                      </form>
                    )}
                    {upload.status === "uploaded" && (
                      <form action={requestAnalysisAction}>
                        <input type="hidden" name="uploadId" value={upload.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="accent"
                          disabled={quota !== null && quota.remaining <= 0}
                        >
                          Request analysis
                        </Button>
                      </form>
                    )}
                    {(upload.status === "queued" || upload.status === "processing") && (
                      <span className="text-xs text-muted">
                        Queued for the background worker — analysis never runs inside a page
                        request.
                      </span>
                    )}
                    {upload.reportId && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/coach/reports/${upload.reportId}`}>View report</Link>
                      </Button>
                    )}
                    <form action={deleteUploadAction} className="ml-auto">
                      <input type="hidden" name="uploadId" value={upload.id} />
                      <Button type="submit" size="sm" variant="destructive">
                        Delete
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Privacy &amp; boundaries</CardTitle>
              <CardDescription>
                Deleting a recording also deletes its analysis, observations, and report. The coach
                never diagnoses cheating, never claims exact hit registration, and never analyzes a
                match while you are in it.
              </CardDescription>
            </CardHeader>
          </Card>
        </>
      )}
    </div>
  );
}
