"use client";

import { Button, Input, Label } from "@clutchlab/ui";
import { useActionState } from "react";

import { createProfileAction } from "@/app/settings/actions";
import type { SensitivityFormState } from "@/app/settings/actions";

const initialState: SensitivityFormState = { error: null, ok: false };

export function CreateProfileForm() {
  const [state, formAction, pending] = useActionState(createProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3" noValidate>
      {state.error ? (
        <p role="alert" className="w-full rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor="profile-name">New profile name</Label>
        <Input id="profile-name" name="name" placeholder="e.g. Main 3-finger" maxLength={60} required />
      </div>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Creating…" : "Create profile"}
      </Button>
      <p className="w-full text-xs text-faint">
        New profiles start with a neutral 100 in every slot — replace them with YOUR current
        in-game values before calibrating. ClutchLab never invents a starting code.
      </p>
    </form>
  );
}
