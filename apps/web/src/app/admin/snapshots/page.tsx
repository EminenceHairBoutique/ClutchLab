import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";

import { DbRequiredNotice } from "@/components/admin/db-required";
import { authMode } from "@/lib/auth/gateway";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import { formatDate } from "@/lib/dates";

import { setSnapshotStatusAction } from "../actions";

export const metadata: Metadata = { title: "Meta snapshots" };

const STATUS_VARIANT = { draft: "outline", published: "success", archived: "default" } as const;

export default async function AdminSnapshotsPage() {
  if (authMode() !== "supabase") return <DbRequiredNotice />;

  const supabase = await createServerSupabase();
  const { data: snapshots, error } = await supabase
    .from("meta_snapshots")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`meta_snapshots read failed: ${error.message}`);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Publishing a snapshot makes its tiers visible to everyone; drafts stay editor-only
        (enforced by RLS, not just this UI). Historical snapshots are archived, never deleted.
      </p>
      {snapshots.map((snapshot) => (
        <Card key={snapshot.id}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm">{snapshot.slug}</CardTitle>
              <Badge variant={STATUS_VARIANT[snapshot.status]}>{snapshot.status}</Badge>
              {snapshot.published_at && (
                <span className="text-xs text-muted">
                  published {formatDate(snapshot.published_at)}
                </span>
              )}
            </div>
            {snapshot.notes && <CardDescription>{snapshot.notes}</CardDescription>}
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {snapshot.status !== "published" && (
              <form action={setSnapshotStatusAction}>
                <input type="hidden" name="snapshotId" value={snapshot.id} />
                <input type="hidden" name="nextStatus" value="published" />
                <Button type="submit" size="sm" variant="accent">
                  Publish
                </Button>
              </form>
            )}
            {snapshot.status === "published" && (
              <form action={setSnapshotStatusAction}>
                <input type="hidden" name="snapshotId" value={snapshot.id} />
                <input type="hidden" name="nextStatus" value="archived" />
                <Button type="submit" size="sm" variant="outline">
                  Archive
                </Button>
              </form>
            )}
            {snapshot.status === "archived" && (
              <form action={setSnapshotStatusAction}>
                <input type="hidden" name="snapshotId" value={snapshot.id} />
                <input type="hidden" name="nextStatus" value="published" />
                <Button type="submit" size="sm" variant="outline">
                  Re-publish
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
