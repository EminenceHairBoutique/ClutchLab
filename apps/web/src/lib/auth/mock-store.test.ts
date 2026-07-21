// @vitest-environment node
import { describe, expect, it } from "vitest";

import { MockAuthStore } from "./mock-store";

describe("MockAuthStore", () => {
  it("creates a user with an empty profile (mirrors the DB signup trigger)", () => {
    const store = new MockAuthStore();
    const created = store.createUser("a@example.com", "password123");
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(store.getProfile(created.user.id)).toMatchObject({ displayName: null, handle: null });
    }
  });

  it("rejects duplicate emails (case-insensitive)", () => {
    const store = new MockAuthStore();
    store.createUser("a@example.com", "password123");
    const dupe = store.createUser("A@Example.com", "other-password");
    expect(dupe.ok).toBe(false);
  });

  it("verifies passwords and rejects bad ones", () => {
    const store = new MockAuthStore();
    store.createUser("a@example.com", "password123");
    expect(store.verifyPassword("a@example.com", "password123")).not.toBeNull();
    expect(store.verifyPassword("a@example.com", "wrong")).toBeNull();
    expect(store.verifyPassword("missing@example.com", "password123")).toBeNull();
  });

  it("manages sessions across create/get/delete", () => {
    const store = new MockAuthStore();
    const created = store.createUser("a@example.com", "password123");
    if (!created.ok) throw new Error("setup failed");
    const token = store.createSession(created.user.id);
    expect(store.getUserBySession(token)?.email).toBe("a@example.com");
    store.deleteSession(token);
    expect(store.getUserBySession(token)).toBeNull();
    expect(store.getUserBySession(undefined)).toBeNull();
  });

  it("updates profiles and enforces unique handles", () => {
    const store = new MockAuthStore();
    const a = store.createUser("a@example.com", "password123");
    const b = store.createUser("b@example.com", "password123");
    if (!a.ok || !b.ok) throw new Error("setup failed");
    expect(store.updateProfile(a.user.id, { handle: "clutch_god" }).ok).toBe(true);
    const conflict = store.updateProfile(b.user.id, { handle: "clutch_god" });
    expect(conflict.ok).toBe(false);
    expect(store.getProfile(a.user.id)?.handle).toBe("clutch_god");
  });
});
