import { Card, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";

/**
 * Editorial tooling writes to the database — the bundled baseline is read-only
 * code. Shown whenever /admin data pages run without configured Supabase.
 */
export function DbRequiredNotice() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Database connection required</CardTitle>
        <CardDescription>
          The editorial console reads and writes live content in Supabase. This environment is
          running on the bundled read-only baseline (no Supabase configured). Connect a project
          per SETUP.md, run <code className="font-mono text-xs">pnpm db:migrate && pnpm db:seed</code>,
          and reload.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
