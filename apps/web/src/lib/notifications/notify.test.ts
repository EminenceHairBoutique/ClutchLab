import { beforeEach, describe, expect, it } from "vitest";

import { getMockAuthStore } from "@/lib/auth/mock-store";

import { notify } from "./notify";

/** §5.18 is strictly opt-in: notify() must be a no-op until the user enables the kind. */

describe("notify (mock mode)", () => {
  let userId: string;

  beforeEach(() => {
    const created = getMockAuthStore().createUser(
      `notify-${Date.now()}-${Math.random()}@example.com`,
      "pw-123456",
    );
    if (!created.ok) throw new Error("test user setup failed");
    userId = created.user.id;
  });

  it("does nothing when the kind is not enabled (default)", async () => {
    const result = await notify(userId, "coach_response", {
      title: "Report ready",
      body: "Your analysis finished.",
      path: "/coach",
    });
    expect(result.delivered).toBe(false);
    expect(getMockAuthStore().listNotifications(userId)).toHaveLength(0);
  });

  it("delivers to the inbox once the user opts in, and respects per-kind scope", async () => {
    const store = getMockAuthStore();
    store.setNotificationPreference(userId, "coach_response", true);

    const delivered = await notify(userId, "coach_response", {
      title: "Report ready",
      body: "Your analysis finished.",
      path: "/coach",
    });
    expect(delivered.delivered).toBe(true);

    // A different, still-disabled kind stays silent.
    const other = await notify(userId, "community_reply", {
      title: "Reply",
      body: "Someone commented.",
      path: "/community",
    });
    expect(other.delivered).toBe(false);

    const inbox = store.listNotifications(userId);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.title).toBe("Report ready");
    expect(inbox[0]?.readAt).toBeNull();

    store.markNotificationsRead(userId);
    expect(store.listNotifications(userId)[0]?.readAt).not.toBeNull();
  });
});
