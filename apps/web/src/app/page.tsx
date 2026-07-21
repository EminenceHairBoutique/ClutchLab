import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@clutchlab/ui";
import Link from "next/link";

import { DESTINATIONS } from "@/lib/navigation";

export default function HomePage() {
  const sections = DESTINATIONS.filter((d) => d.href !== "/");

  return (
    <div className="space-y-8">
      <section className="tactical-grid rounded-xl border border-border bg-surface/60 px-5 py-10 md:px-8">
        <Badge variant="accent">Independent · post-match only · no automation</Badge>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
          Don&apos;t blindly copy a pro. Test, measure, and adapt to your own device.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted md:text-base">
          ClutchLab replaces static sensitivity codes and stale tier lists with a verified,
          versioned, personalized improvement system for PUBG Mobile — built around your device,
          grip, FPS, and mechanics.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="accent">
            <Link href="/profile">Set up your profile</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/meta">Explore the meta</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="version-intel">
        <h2 id="version-intel" className="text-lg font-semibold tracking-tight">
          Version &amp; season intelligence
        </h2>
        <Card className="mt-3">
          <CardHeader>
            <CardTitle>Arrives in Phase 2</CardTitle>
            <CardDescription>
              Current game version, Classic/Casual season, Ultimate Royale window, and patch-impact
              alerts will appear here — each with source, verification date, and region. ClutchLab
              shows nothing it can&apos;t back with a source.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section aria-labelledby="sections-heading">
        <h2 id="sections-heading" className="text-lg font-semibold tracking-tight">
          What&apos;s inside
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((d) => (
            <Link key={d.href} href={d.href} className="group">
              <Card className="h-full transition-colors group-hover:border-border-strong">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="group-hover:text-accent">{d.title}</CardTitle>
                    {!d.live && <Badge variant="outline">Phase {d.phase}</Badge>}
                  </div>
                  <CardDescription>{d.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="safety-heading">
        <h2 id="safety-heading" className="text-lg font-semibold tracking-tight">
          Built safe by design
        </h2>
        <Card className="mt-3">
          <CardContent className="pt-4 text-sm text-muted">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>No macros, overlays, injected code, or live-match assistance — ever.</li>
              <li>Analysis happens after the match, on recordings you choose to upload.</li>
              <li>
                Every time-sensitive fact carries its source, game version, and verification date;
                unverified data is labeled as such in the database itself.
              </li>
              <li>No &ldquo;zero recoil&rdquo; claims. Recoil can be managed, never deleted.</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
