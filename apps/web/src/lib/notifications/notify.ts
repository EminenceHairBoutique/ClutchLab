import "server-only";

import { getServerEnv } from "@clutchlab/config/env";

import { authMode } from "@/lib/auth/gateway";
import { getMockAuthStore } from "@/lib/auth/mock-store";
import { createServiceSupabase } from "@/lib/auth/supabase-server";

import type { NotificationKind } from "./kinds";

/**
 * §5.18 delivery: strictly OPT-IN. notify() checks the recipient's preference
 * for the kind and does nothing unless they enabled it. When it fires it
 * writes the in-app inbox row (server-side only) and, if web-push is
 * configured AND the user has subscriptions, fans out a push.
 */

export interface NotificationPayload {
  title: string;
  body: string;
  path: string | null;
}

export async function notify(
  userId: string,
  kind: NotificationKind,
  payload: NotificationPayload,
): Promise<{ delivered: boolean }> {
  if (authMode() !== "supabase") {
    const store = getMockAuthStore();
    if (!store.isNotificationEnabled(userId, kind)) return { delivered: false };
    store.addNotification(userId, kind, payload.title, payload.body, payload.path);
    await sendWebPush(
      store.listPushSubscriptions(userId).map((s) => ({
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      })),
      payload,
    );
    return { delivered: true };
  }

  const supabase = createServiceSupabase();
  const { data: pref, error: prefError } = await supabase
    .from("notification_preferences")
    .select("enabled")
    .eq("user_id", userId)
    .eq("kind", kind)
    .maybeSingle();
  if (prefError) throw new Error(`preference read failed: ${prefError.message}`);
  if (!pref?.enabled) return { delivered: false };

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    kind,
    title: payload.title,
    body: payload.body,
    link_path: payload.path,
  });
  if (error) throw new Error(`notification insert failed: ${error.message}`);

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (subsError) throw new Error(`push subscriptions read failed: ${subsError.message}`);
  await sendWebPush(
    subs.map((s) => ({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })),
    payload,
  );
  return { delivered: true };
}

export function webPushConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.VAPID_PRIVATE_KEY && env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_SUBJECT);
}

interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Best-effort web push; disabled (silently, by configuration) without VAPID keys. */
async function sendWebPush(targets: PushTarget[], payload: NotificationPayload): Promise<void> {
  if (targets.length === 0 || !webPushConfigured()) return;
  const env = getServerEnv();
  const { default: webpush } = await import("web-push");
  webpush.setVapidDetails(
    env.VAPID_SUBJECT as string,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    env.VAPID_PRIVATE_KEY as string,
  );
  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    path: payload.path ?? "/notifications",
  });
  await Promise.all(
    targets.map(async (target) => {
      try {
        await webpush.sendNotification(target, message);
      } catch (error) {
        // Expired/revoked endpoints are normal; log and continue.
        console.warn(`web push to ${target.endpoint.slice(0, 40)}… failed`, error);
      }
    }),
  );
}
