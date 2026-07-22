import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@clutchlab/ui";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/gateway";
import { checkRoleAtLeast } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/review", label: "Review queue" },
  { href: "/admin/versions", label: "Versions" },
  { href: "/admin/snapshots", label: "Meta snapshots" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/coach", label: "AI reports" },
];

/** Server-authoritative editor gate for every /admin route (spec §12, §13). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Editorial console</h1>
        <span className="text-xs text-muted">signed in as {user.email ?? user.id}</span>
      </div>
      <nav aria-label="Admin sections" className="flex flex-wrap gap-2">
        {ADMIN_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
