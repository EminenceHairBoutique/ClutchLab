"use client";

import { Button, Input, Label } from "@clutchlab/ui";
import { useActionState } from "react";

import {
  deliverBookingAction,
  submitReviewAction,
  type MarketplaceFormState,
} from "@/app/coach/marketplace/actions";

const initialState: MarketplaceFormState = { error: null, ok: false };

export function DeliverForm({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(deliverBookingAction, initialState);
  if (state.ok) return null;
  return (
    <form action={formAction} className="w-full space-y-2" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="bookingId" value={bookingId} />
      <Label htmlFor={`deliverable-${bookingId}`}>Written deliverable</Label>
      <textarea
        id={`deliverable-${bookingId}`}
        name="deliverable"
        required
        maxLength={8000}
        rows={3}
        placeholder="Timestamped findings, what to change, and which drills to run."
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        {pending ? "Delivering…" : "Deliver review"}
      </Button>
    </form>
  );
}

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(submitReviewAction, initialState);
  if (state.ok) {
    return (
      <p role="status" className="text-sm text-muted">
        Review submitted — thanks for keeping ratings honest.
      </p>
    );
  }
  return (
    <form action={formAction} className="flex w-full flex-wrap items-end gap-2" noValidate>
      {state.error ? (
        <p role="alert" className="w-full rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="space-y-1.5">
        <Label htmlFor={`rating-${bookingId}`}>Rating (1–5)</Label>
        <Input
          id={`rating-${bookingId}`}
          name="rating"
          type="number"
          min={1}
          max={5}
          defaultValue={5}
          className="w-20"
          required
        />
      </div>
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor={`review-${bookingId}`}>Review (optional)</Label>
        <Input id={`review-${bookingId}`} name="body" maxLength={1000} />
      </div>
      <Button type="submit" size="sm" variant="accent" disabled={pending}>
        {pending ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}
