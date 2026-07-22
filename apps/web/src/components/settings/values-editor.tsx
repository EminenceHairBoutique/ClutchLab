"use client";

import {
  FAMILIES,
  FAMILY_LABEL,
  SCOPES,
  SCOPE_LABEL,
  keyOf,
  type SensitivityValues,
} from "@clutchlab/calibration";
import { Button, Input, Label } from "@clutchlab/ui";
import { useActionState } from "react";

import { saveVersionAction, type SensitivityFormState } from "@/app/settings/actions";

const initialState: SensitivityFormState = { error: null, ok: false };

interface ValuesEditorProps {
  profileId: string;
  values: SensitivityValues;
}

/** Edit the full family × scope grid; saving creates a NEW immutable version. */
export function ValuesEditor({ profileId, values }: ValuesEditorProps) {
  const [state, formAction, pending] = useActionState(saveVersionAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="profileId" value={profileId} />
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok && !state.error ? (
        <p role="status" className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Saved as a new version.
        </p>
      ) : null}

      {FAMILIES.map((family) => (
        <fieldset key={family} className="space-y-2">
          <legend className="text-sm font-semibold">{FAMILY_LABEL[family]}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(family === "free_look" ? [null] : SCOPES).map((scope) => {
              const key = keyOf({ family, scope });
              const id = `v-${key.replace(":", "-")}`;
              return (
                <div key={key} className="space-y-1">
                  <Label htmlFor={id} className="text-xs text-muted">
                    {scope ? SCOPE_LABEL[scope] : "Free look"}
                  </Label>
                  <Input
                    id={id}
                    name={`v:${key}`}
                    type="number"
                    min={1}
                    max={300}
                    defaultValue={values[key] ?? ""}
                    className="font-mono tabular-nums"
                  />
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="version-note">Version note</Label>
          <Input id="version-note" name="note" placeholder="What changed and why" maxLength={200} />
        </div>
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving…" : "Save as new version"}
        </Button>
      </div>
    </form>
  );
}
