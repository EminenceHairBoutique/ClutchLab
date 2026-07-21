"use server";

import {
  allSlots,
  keyOf,
  recommend,
  sensitivityValueSchema,
  stepBySlug,
  type CalibrationOutcome,
  type SensitivityValues,
} from "@clutchlab/calibration";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authMode, requireUser } from "@/lib/auth/gateway";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import { getSensitivityStore } from "@/lib/data/sensitivity-store";

export interface SensitivityFormState {
  error: string | null;
  ok: boolean;
}

const nameSchema = z.string().trim().min(1).max(60);

/** Starting grid for a new profile — a neutral 100 everywhere, clearly labeled. */
function defaultValues(): SensitivityValues {
  return Object.fromEntries(allSlots().map((slot) => [keyOf(slot), 100]));
}

export async function createProfileAction(
  _prev: SensitivityFormState,
  formData: FormData,
): Promise<SensitivityFormState> {
  const user = await requireUser();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: "Profile name must be 1–60 characters.", ok: false };

  const result = await getSensitivityStore().createProfile(user.id, parsed.data, defaultValues());
  if (!result.ok) return { error: result.error, ok: false };
  redirect(`/settings/sensitivity/${result.data.profileId}`);
}

type ParsedValues = { ok: true; values: SensitivityValues } | { ok: false; error: string };

function parseValuesFromForm(formData: FormData): ParsedValues {
  const values: SensitivityValues = {};
  for (const slot of allSlots()) {
    const key = keyOf(slot);
    const raw = formData.get(`v:${key}`);
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const parsed = sensitivityValueSchema.safeParse(Number(raw));
    if (!parsed.success) {
      return { ok: false, error: `${key}: values must be whole numbers between 1 and 300.` };
    }
    values[key] = parsed.data;
  }
  if (Object.keys(values).length === 0) return { ok: false, error: "Enter at least one value." };
  return { ok: true, values };
}

export async function saveVersionAction(
  _prev: SensitivityFormState,
  formData: FormData,
): Promise<SensitivityFormState> {
  const user = await requireUser();
  const profileId = z.string().min(1).parse(formData.get("profileId"));
  const parsedValues = parseValuesFromForm(formData);
  if (!parsedValues.ok) return { error: parsedValues.error, ok: false };

  const note = z.string().max(200).parse(formData.get("note") ?? "").trim() || "Manual edit";
  const result = await getSensitivityStore().appendVersion(
    user.id,
    profileId,
    parsedValues.values,
    note,
    "manual",
  );
  if (!result.ok) return { error: result.error, ok: false };

  revalidatePath(`/settings/sensitivity/${profileId}`);
  return { error: null, ok: true };
}

export async function rollbackAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const profileId = z.string().min(1).parse(formData.get("profileId"));
  const versionId = z.string().min(1).parse(formData.get("versionId"));
  const versionNo = z.coerce.number().int().parse(formData.get("versionNo"));

  const store = getSensitivityStore();
  const values = await store.getVersionValues(user.id, profileId, versionId);
  if (!values) throw new Error("Version not found.");
  const result = await store.appendVersion(
    user.id,
    profileId,
    values,
    `Rollback to v${versionNo}`,
    "rollback",
  );
  if (!result.ok) throw new Error(result.error);
  revalidatePath(`/settings/sensitivity/${profileId}`);
}

export async function addCodeAction(
  _prev: SensitivityFormState,
  formData: FormData,
): Promise<SensitivityFormState> {
  const user = await requireUser();
  const profileId = z.string().min(1).parse(formData.get("profileId"));
  const kind = z.enum(["sensitivity", "controls"]).parse(formData.get("kind"));
  // Stored VERBATIM — no trimming beyond length limits, no parsing (spec §5.7).
  const code = z.string().min(3).max(200).safeParse(formData.get("code"));
  if (!code.success) return { error: "Codes must be 3–200 characters.", ok: false };
  const label = z.string().max(60).parse(formData.get("label") ?? "").trim() || null;

  const result = await getSensitivityStore().addCode(user.id, profileId, kind, code.data, label);
  if (!result.ok) return { error: result.error, ok: false };
  revalidatePath(`/settings/sensitivity/${profileId}`);
  return { error: null, ok: true };
}

const calibrationPayloadSchema = z.object({
  profileId: z.string().min(1),
  values: z.record(z.string(), sensitivityValueSchema),
  results: z.record(z.string(), z.enum(["overshoot", "undershoot", "on_target", "unstable", "stable"])),
  adjustments: z.array(
    z.object({ step: z.string(), key: z.string(), from: z.number(), to: z.number() }),
  ),
});

export async function saveCalibrationAction(payload: unknown): Promise<{ error: string | null }> {
  const user = await requireUser();
  const parsed = calibrationPayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: "Invalid calibration payload." };
  const { profileId, values, results, adjustments } = parsed.data;

  const note =
    adjustments.length === 0
      ? "Calibration completed — no adjustments needed"
      : `Calibration: ${adjustments.map((a) => `${a.key} ${a.from}→${a.to}`).join(", ")}`;

  const store = getSensitivityStore();
  const saved = await store.appendVersion(user.id, profileId, values, note, "calibration");
  if (!saved.ok) return { error: saved.error };

  // Persist per-step results + server-computed recommendations (database mode).
  if (authMode() === "supabase") {
    const supabase = await createServerSupabase();
    for (const [stepSlug, outcome] of Object.entries(results)) {
      const step = stepBySlug(stepSlug);
      if (!step) continue;
      const { data: result, error } = await supabase
        .from("sensitivity_test_results")
        .insert({ user_id: user.id, test_slug: stepSlug, outcome })
        .select("id")
        .single();
      if (error || !result) continue;
      const rec = recommend(step, outcome as CalibrationOutcome);
      await supabase.from("sensitivity_recommendations").insert({
        user_id: user.id,
        result_id: result.id,
        family: step.adjusts?.family ?? null,
        scope: step.adjusts?.scope ?? null,
        recommendation: rec.kind === "retest" ? "retest" : rec.kind,
        rationale: rec.rationale,
        accepted: rec.factor !== 1,
      });
    }
  }

  revalidatePath(`/settings/sensitivity/${profileId}`);
  return { error: null };
}
