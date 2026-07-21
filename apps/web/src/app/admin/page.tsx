import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/gateway";
import { checkRoleAtLeast, getUserRoles } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Admin",
  description: "ClutchLab editorial and administration console.",
};

export const dynamic = "force-dynamic";

/**
 * Phase 1 stub proving the server-authoritative role gate (editor+). The full
 * editorial console (spec §12) ships as apps/admin in Phase 2.
 */
export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const allowed = await checkRoleAtLeast(user, "editor");
  if (!allowed) {
    return (
      <div className="mx-auto max-w-md py-10">
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>
              This area requires the editor role or higher. Roles are granted server-side only —
              there is no self-service path, by design.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roles = await getUserRoles(user);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <Badge variant="accent">editor+</Badge>
      </div>
      <p className="text-sm text-muted">
        Signed in as {user.email ?? user.id} · roles:{" "}
        {roles.length > 0 ? roles.join(", ") : "none"}
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Editorial console arrives in Phase 2</CardTitle>
          <CardDescription>
            Version and patch ingestion, season dates, weapon and attachment records, the tier
            editor, meta snapshot publishing, pro-profile verification, source management, and the
            audit log land here alongside the versioned content engine.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          The role gate you just passed is enforced in the database via
          <code className="mx-1 rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs">
            public.has_role_at_least(&apos;editor&apos;)
          </code>
          under your own session — not by client-side claims.
        </CardContent>
      </Card>
    </div>
  );
}
