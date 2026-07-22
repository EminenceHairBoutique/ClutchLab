"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/gateway";
import { getDrillRecord, getPlanRecord, getTrainingUserStore } from "@/lib/data/training-store";

export async function startPlanSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const planSlug = z.string().min(1).parse(formData.get("planSlug"));
  const plan = getPlanRecord(planSlug);
  if (!plan) throw new Error("Plan not found.");

  const result = await getTrainingUserStore().createSession(user.id, {
    title: plan.name,
    minutesPlanned: plan.minutes,
    drillSlugs: plan.items.map((i) => i.drillSlug),
    planSlug: plan.slug,
  });
  if (!result.ok) throw new Error(result.error);
  redirect(`/training/sessions/${result.sessionId}`);
}

const generatedSchema = z.object({
  minutes: z.coerce.number().refine((m) => [5, 10, 15, 30, 45, 60].includes(m)),
  drillSlugs: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .refine((slugs) => slugs.length > 0 && slugs.every((slug) => getDrillRecord(slug) !== null), {
      message: "Generated plan contains unknown drills.",
    }),
});

export async function startGeneratedSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = generatedSchema.parse({
    minutes: formData.get("minutes"),
    drillSlugs: formData.get("drillSlugs"),
  });

  const result = await getTrainingUserStore().createSession(user.id, {
    title: `Generated ${parsed.minutes}-minute session`,
    minutesPlanned: parsed.minutes,
    drillSlugs: parsed.drillSlugs,
    planSlug: null,
  });
  if (!result.ok) throw new Error(result.error);
  redirect(`/training/sessions/${result.sessionId}`);
}

export interface LogResultState {
  error: string | null;
  ok: boolean;
}

export async function logResultAction(
  _prev: LogResultState,
  formData: FormData,
): Promise<LogResultState> {
  const user = await requireUser();
  const drillSlug = z.string().min(1).parse(formData.get("drillSlug"));
  if (!getDrillRecord(drillSlug)) return { error: "Unknown drill.", ok: false };
  const sessionId = z.string().nullable().parse(formData.get("sessionId") ?? null);
  const passedRaw = formData.get("passed");
  const passed = passedRaw === "pass" ? true : passedRaw === "fail" ? false : null;
  const ratingRaw = formData.get("selfRating");
  const selfRating =
    typeof ratingRaw === "string" && ratingRaw !== ""
      ? z.coerce.number().int().min(1).max(5).parse(ratingRaw)
      : null;
  const note = z.string().max(200).parse(formData.get("metricNote") ?? "").trim() || null;

  const result = await getTrainingUserStore().logResult(
    user.id,
    sessionId,
    drillSlug,
    passed,
    selfRating,
    note,
  );
  if (!result.ok) return { error: result.error ?? "Could not log result.", ok: false };
  if (sessionId) revalidatePath(`/training/sessions/${sessionId}`);
  return { error: null, ok: true };
}

export async function completeSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const sessionId = z.string().min(1).parse(formData.get("sessionId"));
  const note = z.string().max(300).parse(formData.get("note") ?? "").trim() || null;
  const ok = await getTrainingUserStore().completeSession(user.id, sessionId, note);
  if (!ok) throw new Error("Could not complete session.");
  revalidatePath(`/training/sessions/${sessionId}`);
  revalidatePath("/training");
}
