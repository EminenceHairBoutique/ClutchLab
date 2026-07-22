import { DRILLS, SKILLS } from "@clutchlab/content";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { startGeneratedSessionAction } from "@/app/training/actions";
import { getSessionUser } from "@/lib/auth/gateway";
import { generatePlan, type GeneratePlanInput } from "@/lib/training/generate-plan";

export const metadata: Metadata = { title: "Generated plan" };

export const dynamic = "force-dynamic";

interface GeneratePageProps {
  searchParams: Promise<{ minutes?: string; focus?: string; aa?: string }>;
}

const VALID_MINUTES = [5, 10, 15, 30, 45, 60] as const;

export default async function GeneratePage({ searchParams }: GeneratePageProps) {
  const params = await searchParams;
  const minutes = (VALID_MINUTES as readonly number[]).includes(Number(params.minutes))
    ? (Number(params.minutes) as GeneratePlanInput["minutes"])
    : 15;
  const aimAssist =
    params.aa === "on" || params.aa === "off" ? params.aa : ("mixed" as const);
  const focusCategories = params.focus ? [params.focus] : [];

  const categoryBySkill = new Map(SKILLS.map((s) => [s.slug, s.category]));
  const plan = generatePlan(DRILLS, categoryBySkill, { minutes, focusCategories, aimAssist });
  const user = await getSessionUser();

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/training" className="hover:text-accent">Training</Link> / Generated plan
      </nav>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Your {minutes}-minute plan
        </h1>
        <p className="text-sm text-muted">
          {plan.items.length} drills · {plan.totalMinutes} minutes planned
          {focusCategories.length > 0 && ` · focus: ${focusCategories.join(", ")}`}
        </p>
      </div>

      {plan.notes.map((note) => (
        <p key={note} className="rounded-md border border-info/40 bg-info/10 px-3 py-2 text-sm text-info">
          {note}
        </p>
      ))}

      <div className="space-y-2">
        {plan.items.map((item, index) => (
          <Card key={item.drill.slug}>
            <CardHeader className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-faint">{index + 1}</span>
                <CardTitle className="text-sm">
                  <Link href={`/training/drills/${item.drill.slug}`} className="hover:text-accent">
                    {item.drill.name}
                  </Link>
                </CardTitle>
                <Badge variant="outline">{item.minutes} min</Badge>
                <Badge variant="outline">{item.drill.difficulty}</Badge>
                {item.drill.aimAssistVariant && (
                  <Badge variant="warning">AA {item.drill.aimAssistVariant}</Badge>
                )}
              </div>
              <CardDescription>{item.drill.objective}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {plan.items.length > 0 &&
        (user ? (
          <form action={startGeneratedSessionAction}>
            <input type="hidden" name="minutes" value={minutes} />
            <input
              type="hidden"
              name="drillSlugs"
              value={plan.items.map((i) => i.drill.slug).join(",")}
            />
            <Button type="submit" variant="accent">
              Start this session
            </Button>
          </form>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-between gap-3 pt-4">
              <p className="text-sm text-muted">Sign in to run this session and track results.</p>
              <Button asChild variant="accent">
                <Link href="/login">Sign in</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
