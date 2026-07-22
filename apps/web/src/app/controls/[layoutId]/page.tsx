import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { rollbackLayoutAction } from "@/app/controls/actions";
import { LayoutEditor } from "@/components/controls/layout-editor";
import { getSessionUser } from "@/lib/auth/gateway";
import { getControlsStore } from "@/lib/data/controls-store";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Layout editor" };

export const dynamic = "force-dynamic";

const TEST_DRILLS = [
  { slug: "ads_transition_speed", label: "Scope-fire timing" },
  { slug: "jiggle_basics", label: "Camera continuity while strafing" },
  { slug: "crouch_spray_transition", label: "Crouch spray" },
  { slug: "drop_shot_timing", label: "Drop shot" },
  { slug: "heal_cancel_pressure", label: "Heal cancel" },
];

interface LayoutPageProps {
  params: Promise<{ layoutId: string }>;
}

export default async function LayoutPage({ params }: LayoutPageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { layoutId } = await params;
  const layout = await getControlsStore().getLayout(user.id, layoutId);
  if (!layout) notFound();

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/controls" className="hover:text-accent">Controls</Link> / {layout.name}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{layout.name}</h1>
        <Badge variant="outline">{layout.fingerCount}-finger</Badge>
      </div>

      <LayoutEditor layoutId={layout.id} initialPositions={layout.activePositions} />

      <Card>
        <CardHeader>
          <CardTitle>Version history</CardTitle>
          <CardDescription>
            Immutable — rolling back creates a new version with the old positions, re-analyzed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {layout.versions.map((version) => (
            <div
              key={version.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm"
            >
              <span className="font-mono font-semibold">v{version.versionNo}</span>
              {version.isActive && <Badge variant="accent">active</Badge>}
              <Badge variant="outline">{version.origin}</Badge>
              {version.score !== null && (
                <Badge variant={version.score >= 80 ? "success" : "warning"}>
                  score {version.score}
                </Badge>
              )}
              <span className="text-muted">{version.note ?? "—"}</span>
              <span className="ml-auto text-xs text-faint">{formatDate(version.createdAt)}</span>
              {!version.isActive && (
                <form action={rollbackLayoutAction}>
                  <input type="hidden" name="layoutId" value={layout.id} />
                  <input type="hidden" name="versionId" value={version.id} />
                  <input type="hidden" name="versionNo" value={version.versionNo} />
                  <Button type="submit" size="sm" variant="outline">
                    Roll back to this
                  </Button>
                </form>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test this layout</CardTitle>
          <CardDescription>
            Run the layout test protocol (spec §5.9) before trusting a change in ranked — log
            results on each drill page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-2">
            {TEST_DRILLS.map((drill) => (
              <li key={drill.slug}>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/training/drills/${drill.slug}`}>{drill.label}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
