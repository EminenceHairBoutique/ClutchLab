import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { verifyCoachAction } from "@/app/coach/marketplace/actions";
import { getCoachStore } from "@/lib/data/coach-store";
import { getMarketplaceStore } from "@/lib/data/marketplace-store";
import { formatDate } from "@/lib/dates";

import { reviewReportAction } from "./actions";

export const metadata: Metadata = { title: "AI report review" };

/**
 * Human-review queue for AI coaching reports (spec §5.13.7) and marketplace
 * coach applications (§5.17). The admin layout enforces the editor role; RLS
 * enforces it again at the database.
 */
export default async function AdminCoachPage() {
  const queue = await getCoachStore().listPendingReview();
  const applications = await getMarketplaceStore().listUnverifiedCoaches();

  return (
    <div className="space-y-5">
      {applications.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Coach applications</h2>
          {applications.map((application) => (
            <Card key={application.userId}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm">{application.displayName}</CardTitle>
                  <span className="ml-auto text-xs text-faint">
                    {formatDate(application.createdAt)}
                  </span>
                </div>
                <CardDescription>
                  Claimed credentials: {application.credentials ?? "(none provided)"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={verifyCoachAction}>
                  <input type="hidden" name="coachId" value={application.userId} />
                  <Button type="submit" size="sm" variant="accent">
                    Verify credentials
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
      <p className="text-sm text-muted">
        AI-generated coaching reports awaiting a human spot-check, oldest first. Publishing marks
        the report as reviewed; rejecting flags it as not up to standard. Users can read their own
        reports either way — the badge tells them the review state.
      </p>
      {queue.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Queue clear</CardTitle>
            <CardDescription>No reports pending review.</CardDescription>
          </CardHeader>
        </Card>
      )}
      {queue.map((item) => (
        <Card key={item.id}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">confidence: {item.confidence}</Badge>
              <Badge variant="outline">{item.mistakesCount} mistakes</Badge>
              <span className="font-mono text-xs text-faint">
                {item.modelId} · {item.promptVersion}
              </span>
              <span className="ml-auto text-xs text-faint">{formatDate(item.createdAt)}</span>
            </div>
            <CardDescription>{item.executiveSummary}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/coach/reports/${item.id}`}>Open full report</Link>
            </Button>
            <form action={reviewReportAction}>
              <input type="hidden" name="reportId" value={item.id} />
              <input type="hidden" name="decision" value="published" />
              <Button type="submit" size="sm" variant="accent">
                Publish
              </Button>
            </form>
            <form action={reviewReportAction}>
              <input type="hidden" name="reportId" value={item.id} />
              <input type="hidden" name="decision" value="rejected" />
              <Button type="submit" size="sm" variant="destructive">
                Reject
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
}
