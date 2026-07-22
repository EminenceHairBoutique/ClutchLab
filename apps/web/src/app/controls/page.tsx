import { LAYOUT_TEMPLATES } from "@clutchlab/content";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Stat } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { MockModeBanner } from "@/components/auth/mock-mode-banner";
import { CreateLayoutForm } from "@/components/controls/create-layout-form";
import { getSessionUser } from "@/lib/auth/gateway";
import { getControlsStore } from "@/lib/data/controls-store";

export const metadata: Metadata = {
  title: "Controls",
  description: "Control Layout Studio: drag your HUD, get ergonomic findings, keep version history.",
};

export const dynamic = "force-dynamic";

export default async function ControlsPage() {
  const user = await getSessionUser();
  const layouts = user ? await getControlsStore().listLayouts(user.id) : [];

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Control Layout Studio</h1>
        <p className="text-sm text-muted">
          Original draggable HUD shapes — no game assets. Every save is analyzed for collisions,
          reach, and finger congestion, and every version can be rolled back.
        </p>
      </div>
      <MockModeBanner />

      {user ? (
        <>
          <Card>
            <CardContent className="pt-4">
              <CreateLayoutForm />
            </CardContent>
          </Card>
          <div className="space-y-2">
            {layouts.length === 0 && (
              <p className="text-sm text-muted">No layouts yet — start from a template above.</p>
            )}
            {layouts.map((layout) => (
              <Link key={layout.id} href={`/controls/${layout.id}`} className="block">
                <Card className="transition-colors hover:border-border-strong">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{layout.name}</CardTitle>
                      <Badge variant="outline">{layout.fingerCount}-finger</Badge>
                      {layout.activeVersionNo !== null && (
                        <Badge variant="accent">v{layout.activeVersionNo} active</Badge>
                      )}
                      {layout.activeScore !== null && (
                        <span className="ml-auto text-sm text-muted">
                          ergonomics <Stat value={layout.activeScore} />
                          <span className="text-xs text-faint">/100</span>
                        </span>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sign in to build layouts</CardTitle>
            <CardDescription>
              Layouts, ergonomic analysis history, and test results are saved to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild variant="accent">
              <Link href="/signup">Create account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="templates-heading" className="space-y-2">
        <h2 id="templates-heading" className="text-lg font-semibold tracking-tight">
          Starting templates
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LAYOUT_TEMPLATES.map((template) => (
            <Card key={template.slug}>
              <CardHeader>
                <CardTitle className="text-sm">{template.name}</CardTitle>
                <CardDescription className="text-xs">{template.description}</CardDescription>
                <Badge variant="outline">sample starting point</Badge>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
