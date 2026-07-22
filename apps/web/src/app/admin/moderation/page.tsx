import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";

import { DbRequiredNotice } from "@/components/admin/db-required";
import { authMode, getSessionUser } from "@/lib/auth/gateway";
import { checkRoleAtLeast } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import { formatDate } from "@/lib/dates";

import { moderateReportAction } from "./actions";

export const metadata: Metadata = { title: "Moderation queue" };

export default async function ModerationPage() {
  if (authMode() !== "supabase") return <DbRequiredNotice />;
  const user = await getSessionUser();
  const isModerator = user ? await checkRoleAtLeast(user, "moderator") : false;
  if (!isModerator) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Moderator role required</CardTitle>
          <CardDescription>
            The report queue needs the moderator role or higher (editors handle content, not
            conduct). Role grants are server-side only.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const supabase = await createServerSupabase();
  const { data: reports, error } = await supabase
    .from("reports")
    .select("*")
    .eq("status", "open")
    .order("created_at");
  if (error) throw new Error(`reports read failed: ${error.message}`);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Open reports, oldest first. Every action is recorded in moderation_actions.
      </p>
      {reports.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Queue clear</CardTitle>
            <CardDescription>No open reports.</CardDescription>
          </CardHeader>
        </Card>
      )}
      {reports.map((report) => (
        <Card key={report.id}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="danger">{report.reason.replace(/_/g, " ")}</Badge>
              <Badge variant="outline">{report.entity_type}</Badge>
              <span className="font-mono text-xs text-faint">{report.entity_id}</span>
              <span className="ml-auto text-xs text-faint">{formatDate(report.created_at)}</span>
            </div>
            {report.detail && <CardDescription>{report.detail}</CardDescription>}
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(report.entity_type === "post" || report.entity_type === "comment") && (
              <form action={moderateReportAction}>
                <input type="hidden" name="reportId" value={report.id} />
                <input type="hidden" name="decision" value="remove" />
                <Button type="submit" size="sm" variant="destructive">
                  Remove content
                </Button>
              </form>
            )}
            <form action={moderateReportAction}>
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="decision" value="dismiss" />
              <Button type="submit" size="sm" variant="outline">
                Dismiss report
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
