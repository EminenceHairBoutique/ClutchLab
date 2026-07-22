"use client";

import { Button, Input, Label } from "@clutchlab/ui";
import { useActionState } from "react";

import { logResultAction, type LogResultState } from "@/app/training/actions";

const initialState: LogResultState = { error: null, ok: false };

interface LogResultFormProps {
  drillSlug: string;
  sessionId: string | null;
  compact?: boolean;
}

export function LogResultForm({ drillSlug, sessionId, compact = false }: LogResultFormProps) {
  const [state, formAction, pending] = useActionState(logResultAction, initialState);

  if (state.ok) {
    return (
      <p role="status" className="rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-xs text-success">
        Result logged.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2" noValidate>
      <input type="hidden" name="drillSlug" value={drillSlug} />
      {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
      {state.error ? (
        <p role="alert" className="w-full rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor={`passed-${drillSlug}`} className="text-xs">Result</Label>
        <select
          id={`passed-${drillSlug}`}
          name="passed"
          defaultValue=""
          className="flex h-9 rounded-md border border-border bg-surface px-2 text-sm"
        >
          <option value="">Not judged</option>
          <option value="pass">Passed the bar</option>
          <option value="fail">Below the bar</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`rating-${drillSlug}`} className="text-xs">Feel (1–5)</Label>
        <select
          id={`rating-${drillSlug}`}
          name="selfRating"
          defaultValue=""
          className="flex h-9 rounded-md border border-border bg-surface px-2 text-sm"
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      {!compact && (
        <div className="min-w-40 flex-1 space-y-1">
          <Label htmlFor={`note-${drillSlug}`} className="text-xs">Metric note</Label>
          <Input
            id={`note-${drillSlug}`}
            name="metricNote"
            placeholder="e.g. 8/10 bursts inside"
            maxLength={200}
            className="h-9"
          />
        </div>
      )}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Logging…" : "Log result"}
      </Button>
    </form>
  );
}
