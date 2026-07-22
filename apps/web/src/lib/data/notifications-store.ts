import "server-only";

import { authMode } from "@/lib/auth/gateway";
import { getMockAuthStore } from "@/lib/auth/mock-store";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import { NOTIFICATION_KINDS, type NotificationKind } from "@/lib/notifications/kinds";

export interface NotificationView {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsStore {
  list(userId: string): Promise<NotificationView[]>;
  unreadCount(userId: string): Promise<number>;
  markRead(userId: string, id?: string): Promise<void>;
  preferences(userId: string): Promise<Record<NotificationKind, boolean>>;
  setPreference(userId: string, kind: NotificationKind, enabled: boolean): Promise<void>;
  saveSubscription(
    userId: string,
    sub: { endpoint: string; p256dh: string; auth: string; userAgent: string | null },
  ): Promise<void>;
  deleteSubscription(userId: string, endpoint: string): Promise<void>;
}

function emptyPreferences(): Record<NotificationKind, boolean> {
  return Object.fromEntries(NOTIFICATION_KINDS.map((kind) => [kind, false])) as Record<
    NotificationKind,
    boolean
  >;
}

class MockNotificationsStore implements NotificationsStore {
  async list(userId: string): Promise<NotificationView[]> {
    return getMockAuthStore()
      .listNotifications(userId)
      .map((n) => ({
        id: n.id,
        kind: n.kind as NotificationKind,
        title: n.title,
        body: n.body,
        linkPath: n.linkPath,
        readAt: n.readAt,
        createdAt: n.createdAt,
      }));
  }

  async unreadCount(userId: string): Promise<number> {
    return (await this.list(userId)).filter((n) => n.readAt === null).length;
  }

  async markRead(userId: string, id?: string): Promise<void> {
    getMockAuthStore().markNotificationsRead(userId, id);
  }

  async preferences(userId: string): Promise<Record<NotificationKind, boolean>> {
    const enabled = getMockAuthStore().listNotificationPreferences(userId);
    const prefs = emptyPreferences();
    for (const kind of NOTIFICATION_KINDS) prefs[kind] = enabled.has(kind);
    return prefs;
  }

  async setPreference(userId: string, kind: NotificationKind, enabled: boolean): Promise<void> {
    getMockAuthStore().setNotificationPreference(userId, kind, enabled);
  }

  async saveSubscription(
    userId: string,
    sub: { endpoint: string; p256dh: string; auth: string; userAgent: string | null },
  ): Promise<void> {
    getMockAuthStore().savePushSubscription(userId, sub);
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<void> {
    getMockAuthStore().deletePushSubscription(userId, endpoint);
  }
}

class SupabaseNotificationsStore implements NotificationsStore {
  async list(_userId: string): Promise<NotificationView[]> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("notifications")
      .select("id, kind, title, body, link_path, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(`notifications read failed: ${error.message}`);
    return data.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      linkPath: n.link_path,
      readAt: n.read_at,
      createdAt: n.created_at,
    }));
  }

  async unreadCount(_userId: string): Promise<number> {
    const supabase = await createServerSupabase();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (error) throw new Error(`unread count failed: ${error.message}`);
    return count ?? 0;
  }

  async markRead(_userId: string, id?: string): Promise<void> {
    const supabase = await createServerSupabase();
    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (id) query = query.eq("id", id);
    const { error } = await query;
    if (error) throw new Error(`mark read failed: ${error.message}`);
  }

  async preferences(_userId: string): Promise<Record<NotificationKind, boolean>> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("kind, enabled");
    if (error) throw new Error(`preferences read failed: ${error.message}`);
    const prefs = emptyPreferences();
    for (const row of data) prefs[row.kind] = row.enabled;
    return prefs;
  }

  async setPreference(userId: string, kind: NotificationKind, enabled: boolean): Promise<void> {
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, kind, enabled }, { onConflict: "user_id,kind" });
    if (error) throw new Error(`preference save failed: ${error.message}`);
  }

  async saveSubscription(
    userId: string,
    sub: { endpoint: string; p256dh: string; auth: string; userAgent: string | null },
  ): Promise<void> {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        user_agent: sub.userAgent,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(`subscription save failed: ${error.message}`);
  }

  async deleteSubscription(_userId: string, endpoint: string): Promise<void> {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) throw new Error(`subscription delete failed: ${error.message}`);
  }
}

export function getNotificationsStore(): NotificationsStore {
  return authMode() === "supabase"
    ? new SupabaseNotificationsStore()
    : new MockNotificationsStore();
}
