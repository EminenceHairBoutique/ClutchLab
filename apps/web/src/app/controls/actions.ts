"use server";

import { LAYOUT_TEMPLATES } from "@clutchlab/content";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/gateway";
import { checkCanCreateControlLayout } from "@/lib/billing/entitlement-checks";
import { analyzeLayout } from "@/lib/controls/ergonomics";
import { getControlsStore } from "@/lib/data/controls-store";

export interface ControlsFormState {
  error: string | null;
  ok: boolean;
}

const positionsSchema = z
  .array(
    z.object({
      slug: z.string().regex(/^[a-z0-9_]{2,50}$/),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      size: z.number().min(0.02).max(0.3),
    }),
  )
  .min(3)
  .max(40);

export async function createLayoutAction(
  _prev: ControlsFormState,
  formData: FormData,
): Promise<ControlsFormState> {
  const user = await requireUser();
  const name = z.string().trim().min(1).max(60).safeParse(formData.get("name"));
  if (!name.success) return { error: "Layout name must be 1–60 characters.", ok: false };
  const templateSlug = z.string().parse(formData.get("template"));
  const template = LAYOUT_TEMPLATES.find((t) => t.slug === templateSlug);
  if (!template) return { error: "Unknown template.", ok: false };

  const allowed = await checkCanCreateControlLayout(user.id);
  if (!allowed.ok) return { error: allowed.error, ok: false };

  const positions = template.positions.map((p) => ({ slug: p.slug, x: p.x, y: p.y, size: p.size }));
  const analysis = analyzeLayout(positions);
  const result = await getControlsStore().createLayout(
    user.id,
    name.data,
    template.fingerCount,
    positions,
    analysis,
  );
  if (!result.ok) return { error: result.error, ok: false };
  redirect(`/controls/${result.data.layoutId}`);
}

export async function saveLayoutVersionAction(
  _prev: ControlsFormState,
  formData: FormData,
): Promise<ControlsFormState> {
  const user = await requireUser();
  const layoutId = z.string().min(1).parse(formData.get("layoutId"));
  let parsedPositions: unknown;
  try {
    parsedPositions = JSON.parse(z.string().parse(formData.get("positions")));
  } catch {
    return { error: "Malformed positions payload.", ok: false };
  }
  const positions = positionsSchema.safeParse(parsedPositions);
  if (!positions.success) return { error: "Positions failed validation.", ok: false };
  const note = z.string().max(200).parse(formData.get("note") ?? "").trim() || "Manual edit";

  const analysis = analyzeLayout(positions.data);
  const result = await getControlsStore().appendVersion(
    user.id,
    layoutId,
    positions.data,
    note,
    "manual",
    analysis,
  );
  if (!result.ok) return { error: result.error, ok: false };
  revalidatePath(`/controls/${layoutId}`);
  return { error: null, ok: true };
}

export async function rollbackLayoutAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const layoutId = z.string().min(1).parse(formData.get("layoutId"));
  const versionId = z.string().min(1).parse(formData.get("versionId"));
  const versionNo = z.coerce.number().int().parse(formData.get("versionNo"));

  const store = getControlsStore();
  const positions = await store.getVersionPositions(user.id, layoutId, versionId);
  if (!positions) throw new Error("Version not found.");
  const analysis = analyzeLayout(positions);
  const result = await store.appendVersion(
    user.id,
    layoutId,
    positions,
    `Rollback to v${versionNo}`,
    "rollback",
    analysis,
  );
  if (!result.ok) throw new Error(result.error);
  revalidatePath(`/controls/${layoutId}`);
}
