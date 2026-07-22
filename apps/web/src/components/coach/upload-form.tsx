"use client";

import { UPLOAD_KIND_LABELS, UPLOAD_KINDS } from "@clutchlab/coach";
import { Button, Input, Label } from "@clutchlab/ui";
import { useActionState } from "react";

import { registerUploadAction, type CoachFormState } from "@/app/coach/actions";

const initialState: CoachFormState = { error: null, ok: false };

export function UploadForm() {
  const [state, formAction, pending] = useActionState(registerUploadAction, initialState);

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="upload-kind">Recording type</Label>
          <select
            id="upload-kind"
            name="kind"
            defaultValue="clip"
            className="flex h-10 rounded-md border border-border bg-surface px-3 text-sm"
          >
            {UPLOAD_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {UPLOAD_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="upload-label">Label</Label>
          <Input
            id="upload-label"
            name="label"
            required
            maxLength={120}
            placeholder="e.g. Ranked Erangel final circle, squad wipe attempt"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="upload-duration">Length (seconds)</Label>
          <Input
            id="upload-duration"
            name="durationSeconds"
            type="number"
            min={1}
            max={7200}
            inputMode="numeric"
            placeholder="optional"
          />
        </div>
      </div>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Registering…" : "Register recording"}
      </Button>
    </form>
  );
}
