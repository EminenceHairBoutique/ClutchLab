import { Card, CardContent, CardDescription, CardHeader, CardTitle, Stat } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { DbRequiredNotice } from "@/components/admin/db-required";
import { authMode } from "@/lib/auth/gateway";
import { createServerSupabase } from "@/lib/auth/supabase-server";

export const metadata: Metadata = {
  title: "Admin",
  description: "ClutchLab editorial and administration console.",
};

async function count(table: "game_versions" | "weapons" | "review_tasks" | "meta_snapshots") {
  const supabase = await createServerSupabase();
  const { count: n, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return n ?? 0;
}

export default async function AdminOverviewPage() {
  if (authMode() !== "supabase") {
    return (
      <div className="space-y-4">
        <DbRequiredNotice />
        <p className="text-xs text-faint">
          The role gate above this page is fully functional either way — it runs in the database
          via public.has_role_at_least() when Supabase is connected.
        </p>
      </div>
    );
  }

  const [versions, weapons, reviewTasks, snapshots] = await Promise.all([
    count("game_versions"),
    count("weapons"),
    count("review_tasks"),
    count("meta_snapshots"),
  ]);

  const tiles = [
    { label: "Game versions", value: versions, href: "/admin/versions" },
    { label: "Weapons cataloged", value: weapons, href: "/weapons" },
    { label: "Review tasks", value: reviewTasks, href: "/admin/review" },
    { label: "Meta snapshots", value: snapshots, href: "/admin/snapshots" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href}>
            <Card className="transition-colors hover:border-border-strong">
              <CardContent className="p-4">
                <p className="text-2xl font-bold">
                  <Stat value={tile.value} />
                </p>
                <p className="text-xs text-muted">{tile.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Editorial workflow (spec §12)</CardTitle>
          <CardDescription>
            Live in this phase: version records, the review queue, and snapshot publishing.
            Patch-change normalization, the tier editor, pro-profile verification, and scheduled
            publishing arrive with Phases 3–6. Every mutation records a content revision.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
