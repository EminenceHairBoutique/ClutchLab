import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";

import { DbRequiredNotice } from "@/components/admin/db-required";
import { authMode } from "@/lib/auth/gateway";
import { createServerSupabase } from "@/lib/auth/supabase-server";

import { updateReviewTaskAction } from "../actions";

export const metadata: Metadata = { title: "Review queue" };

const PRIORITY_VARIANT = { high: "danger", medium: "warning", low: "outline" } as const;

export default async function ReviewQueuePage() {
  if (authMode() !== "supabase") return <DbRequiredNotice />;

  const supabase = await createServerSupabase();
  const { data: tasks, error } = await supabase
    .from("review_tasks")
    .select("*")
    .in("status", ["open", "in_progress"])
    .order("priority", { ascending: false })
    .order("created_at");
  if (error) throw new Error(`review_tasks read failed: ${error.message}`);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Open verification work from the research log and patch-impact workflow.
      </p>
      {tasks.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Queue clear</CardTitle>
            <CardDescription>No open review tasks.</CardDescription>
          </CardHeader>
        </Card>
      )}
      {tasks.map((task) => (
        <Card key={task.id}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
              <Badge variant="outline">{task.kind}</Badge>
              {task.status === "in_progress" && <Badge variant="accent">in progress</Badge>}
              <CardTitle className="text-sm">{task.title}</CardTitle>
            </div>
            <CardDescription>{task.detail}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {task.status === "open" && (
              <form action={updateReviewTaskAction}>
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="status" value="in_progress" />
                <Button type="submit" size="sm" variant="outline">
                  Start
                </Button>
              </form>
            )}
            <form action={updateReviewTaskAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="status" value="done" />
              <Button type="submit" size="sm" variant="accent">
                Mark done
              </Button>
            </form>
            <form action={updateReviewTaskAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="status" value="dismissed" />
              <Button type="submit" size="sm" variant="ghost">
                Dismiss
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
