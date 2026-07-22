"use client";

import { Button, Input, Label } from "@clutchlab/ui";
import { useActionState } from "react";

import { applyAsCoachAction, type MarketplaceFormState } from "@/app/coach/marketplace/actions";

const initialState: MarketplaceFormState = { error: null, ok: false };

const KINDS = [
  { value: "clip_review", label: "Clip review" },
  { value: "full_match_review", label: "Full-match review" },
  { value: "sensitivity_calibration", label: "Sensitivity calibration" },
  { value: "control_layout_review", label: "Control-layout review" },
  { value: "ultimate_royale_prep", label: "Ultimate Royale preparation" },
  { value: "squad_vod_review", label: "Squad VOD review" },
  { value: "map_strategy", label: "Map strategy session" },
];

export function CoachApplyForm() {
  const [state, formAction, pending] = useActionState(applyAsCoachAction, initialState);

  if (state.ok) {
    return (
      <p
        role="status"
        className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm"
      >
        Application submitted. An editor reviews your credentials before your profile appears in
        the directory — you can already manage bookings once verified.
      </p>
    );
  }

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="coach-name">Coach name</Label>
          <Input id="coach-name" name="displayName" required maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="coach-region">Region</Label>
          <Input id="coach-region" name="region" required maxLength={20} placeholder="EU / NA / SEA…" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="coach-headline">Headline</Label>
        <Input id="coach-headline" name="headline" required maxLength={120} placeholder="What you coach, in one line" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="coach-bio">Bio</Label>
        <textarea
          id="coach-bio"
          name="bio"
          required
          maxLength={2000}
          rows={3}
          placeholder="How you work, what a session delivers, what players can expect."
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="coach-languages">Languages (comma-separated)</Label>
          <Input id="coach-languages" name="languages" required maxLength={60} placeholder="en, de" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="coach-credentials">Credentials (editors verify this)</Label>
          <Input
            id="coach-credentials"
            name="credentials"
            required
            maxLength={1000}
            placeholder="Team history, results, links"
          />
        </div>
      </div>
      <fieldset className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-4">
        <legend className="px-1 text-xs text-muted">First service</legend>
        <div className="space-y-1.5">
          <Label htmlFor="svc-kind">Type</Label>
          <select
            id="svc-kind"
            name="serviceKind"
            defaultValue="clip_review"
            className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="svc-title">Title</Label>
          <Input id="svc-title" name="serviceTitle" required maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="svc-price">Price (USD)</Label>
          <Input id="svc-price" name="priceUsd" type="number" min={1} max={1000} step="0.01" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="svc-days">Delivery (days)</Label>
          <Input id="svc-days" name="deliveryDays" type="number" min={1} max={30} defaultValue={3} required />
        </div>
      </fieldset>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Submitting…" : "Apply as a coach"}
      </Button>
    </form>
  );
}
