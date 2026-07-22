import { Card, CardContent, CardDescription, CardHeader, CardTitle, Stat } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/gateway";
import { getTrainingUserStore, type WeeklySummary } from "@/lib/data/training-store";

export const metadata: Metadata = {
  title: "Training reports",
  description: "Daily, weekly, and monthly practice reports with your streak.",
};

export const dynamic = "force-dynamic";

function SummaryCard({ title, summary }: { title: string; summary: WeeklySummary }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xl font-bold">
            <Stat value={summary.sessionsCompleted} />
          </p>
          <p className="text-xs text-muted">sessions</p>
        </div>
        <div>
          <p className="text-xl font-bold">
            <Stat value={summary.minutesCompleted} unit="min" />
          </p>
          <p className="text-xs text-muted">deliberate minutes</p>
        </div>
        <div>
          <p className="text-xl font-bold">
            <Stat value={summary.drillsLogged} />
          </p>
          <p className="text-xs text-muted">drill results</p>
        </div>
        <div>
          <p className="text-xl font-bold">
            {summary.passRate !== null ? <Stat value={summary.passRate} unit="%" /> : "—"}
          </p>
          <p className="text-xs text-muted">pass rate</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** §5.14 report cadence over what is actually measured — no invented metrics. */
export default async function TrainingReportsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const reports = await getTrainingUserStore().reports(user.id);

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/training" className="hover:text-accent">
          Training
        </Link>{" "}
        / Reports
      </nav>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Training reports</h1>
        <p className="text-sm text-muted">
          Built only from what you actually logged — completions, minutes, and pass rates. No
          fabricated accuracy scores: metrics like reaction time arrive when they can be measured,
          not estimated.
        </p>
      </div>

      <Card className="border-accent/50">
        <CardHeader>
          <CardTitle>Practice streak</CardTitle>
          <CardDescription>Consecutive days with a completed session or logged drill.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            <Stat value={reports.streakDays} unit={reports.streakDays === 1 ? "day" : "days"} />
          </p>
        </CardContent>
      </Card>

      <SummaryCard title="Today (last 24h)" summary={reports.daily} />
      <SummaryCard title="This week (last 7 days)" summary={reports.weekly} />
      <SummaryCard title="This month (last 30 days)" summary={reports.monthly} />
    </div>
  );
}
