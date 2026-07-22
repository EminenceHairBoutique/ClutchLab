import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { completeSessionAction } from "@/app/training/actions";
import { LogResultForm } from "@/components/training/log-result-form";
import { getSessionUser } from "@/lib/auth/gateway";
import { getDrillRecord, getTrainingUserStore } from "@/lib/data/training-store";

export const metadata: Metadata = { title: "Training session" };

export const dynamic = "force-dynamic";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const session = await getTrainingUserStore().getSession(user.id, id);
  if (!session) notFound();

  const completed = session.status === "completed";

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/training" className="hover:text-accent">Training</Link> / {session.title}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
        <Badge variant={completed ? "success" : "accent"}>{session.status.replace("_", " ")}</Badge>
        <Badge variant="outline">{session.minutesPlanned} min planned</Badge>
      </div>

      {completed && (
        <Card>
          <CardHeader>
            <CardTitle>Session complete</CardTitle>
            <CardDescription>
              {session.results.length} result{session.results.length === 1 ? "" : "s"} logged
              {session.note ? ` — “${session.note}”` : ""}. Weekly totals update on the training
              overview.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="space-y-3">
        {session.drillSlugs.map((slug, index) => {
          const drill = getDrillRecord(slug);
          const result = session.results.find((r) => r.drillSlug === slug);
          return (
            <Card key={`${slug}-${index}`}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-faint">{index + 1}</span>
                  <CardTitle className="text-sm">
                    <Link href={`/training/drills/${slug}`} className="hover:text-accent">
                      {drill?.name ?? slug}
                    </Link>
                  </CardTitle>
                  {result &&
                    (result.passed === true ? (
                      <Badge variant="success">passed</Badge>
                    ) : result.passed === false ? (
                      <Badge variant="danger">below bar</Badge>
                    ) : (
                      <Badge variant="outline">logged</Badge>
                    ))}
                </div>
                {drill && <CardDescription>Pass bar: {drill.passingScore}</CardDescription>}
              </CardHeader>
              {!completed && (
                <CardContent>
                  {result ? (
                    <p className="text-xs text-muted">
                      Logged{result.metricNote ? `: ${result.metricNote}` : ""}
                      {result.selfRating ? ` · feel ${result.selfRating}/5` : ""}
                    </p>
                  ) : (
                    <LogResultForm drillSlug={slug} sessionId={session.id} />
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {!completed && (
        <Card>
          <CardHeader>
            <CardTitle>Finish up</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={completeSessionAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="sessionId" value={session.id} />
              <div className="min-w-56 flex-1 space-y-1.5">
                <Label htmlFor="session-note">Session note (optional)</Label>
                <Input id="session-note" name="note" maxLength={300} placeholder="What improved, what didn't" />
              </div>
              <Button type="submit" variant="accent">Complete session</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
