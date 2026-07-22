import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@clutchlab/ui";
import { getServerEnv } from "@clutchlab/config/env";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MockModeBanner } from "@/components/auth/mock-mode-banner";
import { PushSubscribe } from "@/components/notifications/push-subscribe";
import { getSessionUser } from "@/lib/auth/gateway";
import { getNotificationsStore } from "@/lib/data/notifications-store";
import { formatDate } from "@/lib/dates";
import { KIND_LABELS, NOTIFICATION_KINDS } from "@/lib/notifications/kinds";

import { markAllReadAction, savePreferencesAction } from "./actions";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Granular, opt-in alerts: patches, seasons, coaching, training, community.",
};

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const store = getNotificationsStore();
  const [items, preferences] = await Promise.all([store.list(user.id), store.preferences(user.id)]);
  const unread = items.filter((n) => n.readAt === null).length;
  const vapidPublicKey = getServerEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          {unread > 0 && <Badge variant="accent">{unread} unread</Badge>}
        </div>
        <p className="text-sm text-muted">
          Everything here is opt-in — nothing fires unless you turn that kind on below.
        </p>
      </div>
      <MockModeBanner />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Inbox</h2>
          {unread > 0 && (
            <form action={markAllReadAction}>
              <Button type="submit" size="sm" variant="outline">
                Mark all read
              </Button>
            </form>
          )}
        </div>
        {items.length === 0 && (
          <p className="text-sm text-muted">
            Nothing yet. Enable the kinds you care about and alerts will land here (and as push,
            if you enable it on a device).
          </p>
        )}
        {items.map((item) => (
          <Card key={item.id} className={item.readAt === null ? "border-accent/50" : undefined}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm">{item.title}</CardTitle>
                {item.readAt === null && <Badge variant="accent">new</Badge>}
                <Badge variant="outline">{KIND_LABELS[item.kind]?.label ?? item.kind}</Badge>
                <span className="ml-auto text-xs text-faint">{formatDate(item.createdAt)}</span>
              </div>
              <CardDescription>{item.body}</CardDescription>
            </CardHeader>
            {item.linkPath && (
              <CardContent>
                <Button asChild size="sm" variant="outline">
                  <Link href={item.linkPath}>Open</Link>
                </Button>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What to notify you about</CardTitle>
          <CardDescription>
            The §5.18 list, all off by default. Version/season/mode alerts start firing once the
            editorial pipeline publishes those events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={savePreferencesAction} className="space-y-2">
            {NOTIFICATION_KINDS.map((kind) => (
              <label key={kind} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name={`pref:${kind}`}
                  defaultChecked={preferences[kind]}
                  className="mt-1 accent-[#00e5a0]"
                />
                <span>
                  <span className="font-medium">{KIND_LABELS[kind].label}</span>
                  <span className="block text-xs text-muted">{KIND_LABELS[kind].description}</span>
                </span>
              </label>
            ))}
            <Button type="submit" size="sm" variant="accent">
              Save preferences
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Push to this device</CardTitle>
          <CardDescription>
            Web push delivers even when the tab is closed. On iPhone, install ClutchLab to your
            Home Screen first — iOS only allows push for installed web apps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vapidPublicKey ? (
            <PushSubscribe vapidPublicKey={vapidPublicKey} />
          ) : (
            <p className="text-sm text-warning" role="status">
              Web push is not configured on this deployment (VAPID keys absent) — in-app
              notifications still work. See SETUP.md to enable push.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
