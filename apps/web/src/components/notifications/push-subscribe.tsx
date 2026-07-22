"use client";

import { Button } from "@clutchlab/ui";
import { useEffect, useState } from "react";

import { savePushSubscriptionAction } from "@/app/notifications/actions";

/**
 * Per-device web push opt-in. Rendered only when VAPID keys are configured;
 * subscribes through the service worker and stores the subscription
 * server-side. On iPhone this requires the app to be installed to the Home
 * Screen first (iOS 16.4+), which the copy explains.
 */
export function PushSubscribe({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<"unknown" | "unsupported" | "ready" | "subscribed" | "denied">(
    "unknown",
  );

  useEffect(() => {
    let active = true;
    const detect = async (): Promise<typeof state> => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      return existing ? "subscribed" : "ready";
    };
    void detect().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  async function subscribe() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState("denied");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey,
    });
    const json = subscription.toJSON();
    const form = new FormData();
    form.set("endpoint", subscription.endpoint);
    form.set("p256dh", json.keys?.p256dh ?? "");
    form.set("auth", json.keys?.auth ?? "");
    form.set("userAgent", navigator.userAgent.slice(0, 300));
    await savePushSubscriptionAction(form);
    setState("subscribed");
  }

  if (state === "unsupported") {
    return (
      <p className="text-sm text-muted">
        This browser doesn&apos;t support web push. On iPhone, install ClutchLab to your Home
        Screen first (Share → Add to Home Screen), then enable push from the installed app.
      </p>
    );
  }
  if (state === "subscribed") {
    return <p className="text-sm text-muted">Push is enabled on this device.</p>;
  }
  if (state === "denied") {
    return (
      <p className="text-sm text-warning">
        Notifications are blocked for this site — allow them in browser settings to enable push.
      </p>
    );
  }
  return (
    <Button size="sm" variant="accent" disabled={state !== "ready"} onClick={() => void subscribe()}>
      Enable push on this device
    </Button>
  );
}
