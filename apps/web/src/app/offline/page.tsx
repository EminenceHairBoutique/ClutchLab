import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline" };

/** Service-worker fallback for navigations with no network and no cache. */
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">You&apos;re offline</h1>
      <Card>
        <CardHeader>
          <CardTitle>No connection right now</CardTitle>
          <CardDescription>
            Pages you visited recently keep working from cache — the meta snapshot, drills, and
            settings explainers you&apos;ve already opened are the most useful ones to have
            around. Anything that saves or analyzes needs the network.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="accent">
            <Link href="/">Try again</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
