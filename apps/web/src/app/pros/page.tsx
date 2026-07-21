import { Card, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { ProvenanceNote } from "@/components/meta/provenance-note";
import { VerificationBadge } from "@/components/pros/verification-badge";
import { getProStore } from "@/lib/data/pro-store";

export const metadata: Metadata = {
  title: "Pros",
  description: "Pro and creator settings with explicit verification labels and staleness rules.",
};

export const dynamic = "force-dynamic";

export default async function ProsPage() {
  const store = getProStore();
  const pros = await store.listPros();

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Pro settings vault</h1>
        <p className="text-sm text-muted">
          Every profile carries a verification label and goes stale when patches change relevant
          settings. Don&apos;t copy blindly — compare, fork, then test on your own device.
        </p>
      </div>

      <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
        The current entries are <strong>fictional sample profiles</strong> demonstrating the vault.
        Real verified profiles arrive through the editorial verification workflow with sources
        attached — ClutchLab never publishes invented settings for real players.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pros.map((pro) => (
          <Link key={pro.slug} href={`/pros/${pro.slug}`} className="group">
            <Card className="h-full transition-colors group-hover:border-border-strong">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="group-hover:text-accent">{pro.displayName}</CardTitle>
                  <VerificationBadge level={pro.verification} />
                </div>
                <CardDescription>
                  {[pro.teamName, pro.region, pro.role, pro.deviceLabel]
                    .filter(Boolean)
                    .join(" · ")}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <ProvenanceNote provenance={store.provenance} />
    </div>
  );
}
