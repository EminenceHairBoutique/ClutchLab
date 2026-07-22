"use client";

import { LAYOUT_TEMPLATES } from "@clutchlab/content";
import { Button, Input, Label } from "@clutchlab/ui";
import { useActionState } from "react";

import { createLayoutAction, type ControlsFormState } from "@/app/controls/actions";

const initialState: ControlsFormState = { error: null, ok: false };

export function CreateLayoutForm() {
  const [state, formAction, pending] = useActionState(createLayoutAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3" noValidate>
      {state.error ? (
        <p role="alert" className="w-full rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="min-w-44 flex-1 space-y-1.5">
        <Label htmlFor="layout-name">New layout name</Label>
        <Input id="layout-name" name="name" placeholder="e.g. Main claw" maxLength={60} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="layout-template">Starting template</Label>
        <select
          id="layout-template"
          name="template"
          defaultValue="four_finger"
          className="flex h-10 rounded-md border border-border bg-surface px-3 text-sm"
        >
          {LAYOUT_TEMPLATES.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Creating…" : "Create layout"}
      </Button>
      <p className="w-full text-xs text-faint">
        Templates are editorial starting points (sample data) — drag everything to fit your hands.
      </p>
    </form>
  );
}
