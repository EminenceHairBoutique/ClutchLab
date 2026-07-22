"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/gateway";
import { getProfileStore, type ProfileFormValues } from "@/lib/data/profile-store";
import { emptyToNull, profileSchema } from "@/lib/profile/schema";

export interface ProfileFormState {
  error: string | null;
  saved: boolean;
}

export async function saveProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    displayName: emptyToNull(formData.get("displayName")),
    handle: emptyToNull(formData.get("handle"))?.toLowerCase() ?? null,
    region: emptyToNull(formData.get("region")),
    primaryDeviceId: emptyToNull(formData.get("primaryDeviceId")),
    fingerCount: emptyToNull(formData.get("fingerCount")),
    gripStyle: emptyToNull(formData.get("gripStyle")),
    gyroMode: emptyToNull(formData.get("gyroMode")),
    aimAssistPref: emptyToNull(formData.get("aimAssistPref")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input.", saved: false };
  }

  const values: ProfileFormValues = parsed.data;
  const result = await getProfileStore().saveProfile(user.id, values);
  if (!result.ok) return { error: result.error, saved: false };

  revalidatePath("/profile");
  return { error: null, saved: true };
}
