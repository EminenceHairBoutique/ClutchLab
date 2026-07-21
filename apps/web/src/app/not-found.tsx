import { Button } from "@clutchlab/ui";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted">
        That route doesn&apos;t exist — or its content was retired with an old game version.
      </p>
      <Button asChild variant="accent">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
