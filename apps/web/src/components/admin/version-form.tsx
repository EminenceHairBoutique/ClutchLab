"use client";

import { Button, Input, Label } from "@clutchlab/ui";
import { useActionState } from "react";

import { createVersionAction, type AdminFormState } from "@/app/admin/actions";

const initialState: AdminFormState = { error: null, ok: false };

export function VersionForm() {
  const [state, formAction, pending] = useActionState(createVersionAction, initialState);

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok && !state.error ? (
        <p role="status" className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Version created (unverified until reviewed).
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="version">Version</Label>
          <Input id="version" name="version" placeholder="4.6" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="editionSlug">Edition</Label>
          <Input id="editionSlug" name="editionSlug" defaultValue="global" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="releasedOn">Released on</Label>
          <Input id="releasedOn" name="releasedOn" type="date" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="headline">Headline</Label>
          <Input id="headline" name="headline" placeholder="What this version changes" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sourceName">Source name (required)</Label>
          <Input id="sourceName" name="sourceName" placeholder="Official patch notes" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sourceUrl">Source URL</Label>
          <Input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://…" />
        </div>
      </div>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Creating…" : "Create version (unverified)"}
      </Button>
    </form>
  );
}
