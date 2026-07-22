"use server";

import { UPLOAD_KINDS } from "@clutchlab/coach";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/gateway";
import { getCoachStore } from "@/lib/data/coach-store";

export interface CoachFormState {
  error: string | null;
  ok: boolean;
}

const registerSchema = z.object({
  kind: z.enum(UPLOAD_KINDS),
  label: z.string().trim().min(3).max(120),
  durationSeconds: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(7200)])
    .transform((v) => (v === "" ? null : v)),
});

export async function registerUploadAction(
  _prev: CoachFormState,
  formData: FormData,
): Promise<CoachFormState> {
  const user = await requireUser();
  const parsed = registerSchema.safeParse({
    kind: formData.get("kind"),
    label: formData.get("label"),
    durationSeconds: formData.get("durationSeconds") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid upload details.", ok: false };
  }
  const result = await getCoachStore().registerUpload(user.id, parsed.data);
  if (!result.ok) return { error: result.error, ok: false };
  revalidatePath("/coach");
  return { error: null, ok: true };
}

export async function markUploadedAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const uploadId = z.string().uuid().parse(formData.get("uploadId"));
  const result = await getCoachStore().markUploaded(user.id, uploadId);
  revalidatePath("/coach");
  if (!result.ok) redirect(`/coach?error=${encodeURIComponent(result.error)}`);
}

export async function requestAnalysisAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const uploadId = z.string().uuid().parse(formData.get("uploadId"));
  const result = await getCoachStore().requestAnalysis(user.id, uploadId);
  revalidatePath("/coach");
  if (!result.ok) redirect(`/coach?error=${encodeURIComponent(result.error)}`);
}

export async function deleteUploadAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const uploadId = z.string().uuid().parse(formData.get("uploadId"));
  const deleted = await getCoachStore().deleteUpload(user.id, uploadId);
  revalidatePath("/coach");
  if (!deleted) redirect(`/coach?error=${encodeURIComponent("Upload not found.")}`);
}
