import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/gateway";
import { getNotificationsStore } from "@/lib/data/notifications-store";

export const dynamic = "force-dynamic";

/** Lightweight unread badge source for the nav bell. 0 when signed out. */
export async function GET(): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ count: 0 }, { headers: { "cache-control": "no-store" } });
  const count = await getNotificationsStore().unreadCount(user.id);
  return NextResponse.json({ count }, { headers: { "cache-control": "no-store" } });
}
