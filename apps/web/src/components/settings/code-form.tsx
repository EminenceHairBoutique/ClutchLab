"use client";

import { Button, Input, Label } from "@clutchlab/ui";
import { useActionState } from "react";

import { addCodeAction, type SensitivityFormState } from "@/app/settings/actions";

const initialState: SensitivityFormState = { error: null, ok: false };

export function CodeForm({ profileId }: { profileId: string }) {
  const [state, formAction, pending] = useActionState(addCodeAction, initialState);

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="profileId" value={profileId} />
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="code">Your in-game share code</Label>
          <Input id="code" name="code" placeholder="Paste exactly as the game produced it" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="code-kind">Type</Label>
          <select
            id="code-kind"
            name="kind"
            defaultValue="sensitivity"
            className="flex h-10 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            <option value="sensitivity">Sensitivity</option>
            <option value="controls">Controls</option>
          </select>
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Storing…" : "Store verbatim"}
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="code-label">Label (optional)</Label>
        <Input id="code-label" name="label" placeholder="e.g. before S31 calibration" maxLength={60} />
      </div>
      <p className="text-xs text-faint">
        Codes are stored exactly as pasted, attached to this profile. ClutchLab never parses codes
        into values and never generates codes the game didn&apos;t produce.
      </p>
    </form>
  );
}
