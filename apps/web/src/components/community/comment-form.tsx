"use client";

import { Button, Label } from "@clutchlab/ui";
import { useActionState } from "react";

import { addCommentAction, type CommunityFormState } from "@/app/community/actions";

const initialState: CommunityFormState = { error: null, ok: false };

export function CommentForm({ postId }: { postId: string }) {
  const [state, formAction, pending] = useActionState(addCommentAction, initialState);

  return (
    <form action={formAction} className="space-y-2" noValidate>
      <input type="hidden" name="postId" value={postId} />
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
      <Label htmlFor={`comment-${postId}`}>Add a comment</Label>
      <textarea
        id={`comment-${postId}`}
        name="body"
        required
        maxLength={4000}
        rows={2}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Sending…" : "Comment"}
      </Button>
    </form>
  );
}
