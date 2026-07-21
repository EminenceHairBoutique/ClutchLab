import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CalibrationWizard } from "@/components/settings/calibration-wizard";
import { getSessionUser } from "@/lib/auth/gateway";
import { getSensitivityStore } from "@/lib/data/sensitivity-store";

export const metadata: Metadata = { title: "Guided calibration" };

export const dynamic = "force-dynamic";

interface CalibratePageProps {
  params: Promise<{ profileId: string }>;
}

export default async function CalibratePage({ params }: CalibratePageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { profileId } = await params;
  const profile = await getSensitivityStore().getProfile(user.id, profileId);
  if (!profile) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href={`/settings/sensitivity/${profile.id}`} className="hover:text-accent">
          {profile.name}
        </Link>{" "}
        / Guided calibration
      </nav>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Guided calibration</h1>
        <p className="text-sm text-muted">
          Fourteen Training Grounds steps. Each test judges one thing and adjusts at most one
          value by a small bucket — never chase big swings. Your session saves as one new version
          at the end.
        </p>
      </div>
      <CalibrationWizard profileId={profile.id} initialValues={profile.activeValues} />
    </div>
  );
}
