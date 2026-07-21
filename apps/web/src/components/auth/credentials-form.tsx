"use client";

import { Button, Input, Label } from "@clutchlab/ui";
import Link from "next/link";
import { useActionState } from "react";

import type { AuthFormState } from "@/lib/auth/actions";

const initialState: AuthFormState = { error: null, notice: null };

interface CredentialsFormProps {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  alternate: { text: string; href: string; linkLabel: string };
}

export function CredentialsForm({ action, submitLabel, alternate }: CredentialsFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="rounded-md border border-info/40 bg-info/10 px-3 py-2 text-sm text-info">
          {state.notice}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
        />
        <p className="text-xs text-faint">At least 8 characters.</p>
      </div>
      <Button type="submit" variant="accent" className="w-full" disabled={pending}>
        {pending ? "Working…" : submitLabel}
      </Button>
      <p className="text-center text-sm text-muted">
        {alternate.text}{" "}
        <Link href={alternate.href} className="text-accent hover:underline">
          {alternate.linkLabel}
        </Link>
      </p>
    </form>
  );
}
