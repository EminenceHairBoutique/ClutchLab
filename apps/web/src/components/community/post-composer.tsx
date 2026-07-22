"use client";

import { Button, Input, Label } from "@clutchlab/ui";
import { useActionState } from "react";

import { createPostAction, type CommunityFormState } from "@/app/community/actions";

const initialState: CommunityFormState = { error: null, ok: false };

const KINDS = [
  { value: "discussion", label: "Discussion" },
  { value: "question", label: "Question" },
  { value: "settings", label: "Settings share" },
  { value: "layout", label: "Layout share" },
  { value: "drill_result", label: "Drill result" },
  { value: "meta_debate", label: "Meta debate" },
  { value: "squad_recruitment", label: "Squad recruitment" },
];

export function PostComposer() {
  const [state, formAction, pending] = useActionState(createPostAction, initialState);

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.flagged ? (
        <p role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          Your post was held for moderator review — it matched an automated risk flag. If it
          doesn&apos;t break the rules it will be restored.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="post-kind">Type</Label>
          <select
            id="post-kind"
            name="kind"
            defaultValue="discussion"
            className="flex h-10 rounded-md border border-border bg-surface px-3 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="post-title">Title</Label>
          <Input id="post-title" name="title" maxLength={140} required placeholder="Say it in one line" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="post-body">Body</Label>
        <textarea
          id="post-body"
          name="body"
          required
          maxLength={8000}
          rows={4}
          placeholder="Details, evidence, and what you actually tested — claims need sources here."
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
      </div>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Posting…" : "Post"}
      </Button>
    </form>
  );
}
