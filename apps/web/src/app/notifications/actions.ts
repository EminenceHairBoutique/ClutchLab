"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/gateway";
import { getNotificationsStore } from "@/lib/data/notifications-store";
import { NOTIFICATION_KINDS } from "@/lib/notifications/kinds";

export async function markAllReadAction(): Promise<void> {
  const user = await requireUser();
  await getNotificationsStore().markRead(user.id);
  revalidatePath("/notifications");
}

/** Saves the full §5.18 preference matrix; unchecked boxes mean opted out. */
export async function savePreferencesAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const store = getNotificationsStore();
  for (const kind of NOTIFICATION_KINDS) {
    await store.setPreference(user.id, kind, formData.get(`pref:${kind}`) === "on");
  }
  revalidatePath("/notifications");
}

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(10),
  auth: z.string().min(5),
});

export async function savePushSubscriptionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = subscriptionSchema.parse({
    endpoint: formData.get("endpoint"),
    p256dh: formData.get("p256dh"),
    auth: formData.get("auth"),
  });
  await getNotificationsStore().saveSubscription(user.id, {
    ...parsed,
    userAgent: z.string().max(300).nullable().parse(formData.get("userAgent") ?? null),
  });
  revalidatePath("/notifications");
}

export async function deletePushSubscriptionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const endpoint = z.string().url().parse(formData.get("endpoint"));
  await getNotificationsStore().deleteSubscription(user.id, endpoint);
  revalidatePath("/notifications");
}
