import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { startPlanSessionAction } from "@/app/training/actions";
import { getSessionUser } from "@/lib/auth/gateway";
import { getDrillRecord, getPlanRecord } from "@/lib/data/training-store";

export const dynamic = "force-dynamic";

interface PlanPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PlanPageProps): Promise<Metadata> {
  const { slug } = await params;
  const plan = getPlanRecord(slug);
  return { title: plan ? plan.name : "Plan not found" };
}

export default async function PlanPage({ params }: PlanPageProps) {
  const { slug } = await params;
  const plan = getPlanRecord(slug);
  if (!plan) notFound();
  const user = await getSessionUser();

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/training" className="hover:text-accent">Training</Link> / {plan.name}
      </nav>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{plan.name}</h1>
          <Badge variant="outline">{plan.minutes} min</Badge>
          {plan.aimAssistFocus === "off" && <Badge variant="warning">aim assist off</Badge>}
        </div>
        <p className="text-sm text-muted">{plan.description}</p>
      </div>

      <div className="space-y-2">
        {plan.items.map((item, index) => {
          const drill = getDrillRecord(item.drillSlug);
          return (
            <Card key={`${item.drillSlug}-${index}`}>
              <CardHeader className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-faint">{index + 1}</span>
                  <CardTitle className="text-sm">
                    <Link href={`/training/drills/${item.drillSlug}`} className="hover:text-accent">
                      {drill?.name ?? item.drillSlug}
                    </Link>
                  </CardTitle>
                  <Badge variant="outline">{item.minutes} min</Badge>
                </div>
                {item.note && <CardDescription>{item.note}</CardDescription>}
                {drill && <CardDescription>{drill.objective}</CardDescription>}
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {user ? (
        <form action={startPlanSessionAction}>
          <input type="hidden" name="planSlug" value={plan.slug} />
          <Button type="submit" variant="accent">Start this session</Button>
        </form>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 pt-4">
            <p className="text-sm text-muted">Sign in to run this plan and track results.</p>
            <Button asChild variant="accent">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
