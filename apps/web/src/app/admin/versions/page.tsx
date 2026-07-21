import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";

import { DbRequiredNotice } from "@/components/admin/db-required";
import { VersionForm } from "@/components/admin/version-form";
import { StatusBadge, ConfidenceBadge } from "@/components/meta/badges";
import { authMode } from "@/lib/auth/gateway";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Versions" };

export default async function AdminVersionsPage() {
  if (authMode() !== "supabase") return <DbRequiredNotice />;

  const supabase = await createServerSupabase();
  const { data: versions, error } = await supabase
    .from("game_versions")
    .select("*")
    .order("released_on", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`game_versions read failed: ${error.message}`);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Create a game version</CardTitle>
          <CardDescription>
            New records start unverified with their source attached — verification happens in the
            review queue, never at creation time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VersionForm />
        </CardContent>
      </Card>

      <div className="space-y-2">
        {versions.map((v) => (
          <Card key={v.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>
                  {v.version} · {v.edition_slug}
                </CardTitle>
                <StatusBadge status={v.data_status} />
                <ConfidenceBadge level={v.confidence} />
              </div>
              <CardDescription>
                Released {formatDate(v.released_on)} · {v.headline ?? "no headline"} · source:{" "}
                {v.source_name ?? "missing"}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
