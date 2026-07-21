"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/gateway";
import { getProStore } from "@/lib/data/pro-store";
import { getSensitivityStore } from "@/lib/data/sensitivity-store";

/**
 * Fork a pro's published values into a NEW user profile (spec §5.8: fork as a
 * starting point). The fork records its origin; the comparison page has already
 * warned that values may not translate across devices.
 */
export async function forkProAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const proSlug = z.string().min(1).parse(formData.get("proSlug"));

  const pro = await getProStore().getPro(proSlug);
  if (!pro) throw new Error("Pro profile not found.");

  const store = getSensitivityStore();
  const baseName = `Fork of ${pro.displayName}`;
  let created = await store.createProfile(user.id, baseName, pro.values);
  if (!created.ok) {
    created = await store.createProfile(
      user.id,
      `${baseName} (${new Date().toISOString().slice(11, 19)})`,
      pro.values,
    );
  }
  if (!created.ok) throw new Error(created.error);

  await store.appendVersion(
    user.id,
    created.data.profileId,
    pro.values,
    `Forked from ${pro.displayName} (${pro.verification}) — test on YOUR device before trusting it`,
    "fork",
  );
  redirect(`/settings/sensitivity/${created.data.profileId}`);
}
