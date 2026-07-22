"use client";

import { Button, Label } from "@clutchlab/ui";
import { useActionState } from "react";

import { submitReportAction, type CommunityFormState } from "@/app/community/actions";

const initialState: CommunityFormState = { error: null, ok: false };

const REASONS = [
  { value: "cheating_content", label: "Cheats / hacks" },
  { value: "macro_or_script", label: "Macros / scripts" },
  { value: "account_trading", label: "Account trading" },
  { value: "uc_scam", label: "UC scam" },
  { value: "credential_request", label: "Credential request" },
  { value: "harassment", label: "Harassment" },
  { value: "false_verification", label: "False verification claim" },
  { value: "copyright", label: "Copyright" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
];

export function ReportForm({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [state, formAction, pending] = useActionState(submitReportAction, initialState);

  if (state.ok) {
    return (
      <p role="status" className="rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-xs text-success">
        Report submitted — a moderator will review it.
      </p>
    );
  }

  return (
    <details className="text-sm">
      <summary className="cursor-pointer select-none text-xs text-faint hover:text-muted">Report this</summary>
      <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="entityType" value={entityType} />
        <input type="hidden" name="entityId" value={entityId} />
        {state.error ? (
          <p role="alert" className="w-full rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger">
            {state.error}
          </p>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor={`reason-${entityId}`} className="text-xs">Reason</Label>
          <select
            id={`reason-${entityId}`}
            name="reason"
            defaultValue="spam"
            className="flex h-9 rounded-md border border-border bg-surface px-2 text-sm"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="min-w-40 flex-1 space-y-1">
          <Label htmlFor={`detail-${entityId}`} className="text-xs">Detail (optional)</Label>
          <input
            id={`detail-${entityId}`}
            name="detail"
            maxLength={1000}
            className="flex h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Sending…" : "Submit report"}
        </Button>
      </form>
    </details>
  );
}
