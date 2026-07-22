// @vitest-environment node
import { describe, expect, it } from "vitest";

import { roleAtLeast } from "./roles";
import { MockAuthStore } from "./mock-store";

describe("roleAtLeast", () => {
  it("passes when any held role meets the minimum rank", () => {
    expect(roleAtLeast(["player"], "player")).toBe(true);
    expect(roleAtLeast(["editor"], "editor")).toBe(true);
    expect(roleAtLeast(["admin"], "editor")).toBe(true);
    expect(roleAtLeast(["super_admin"], "admin")).toBe(true);
  });

  it("fails when all held roles are below the minimum", () => {
    expect(roleAtLeast(["player"], "editor")).toBe(false);
    expect(roleAtLeast(["coach"], "editor")).toBe(false);
    expect(roleAtLeast([], "player")).toBe(false);
  });

  it("ignores unknown role slugs instead of granting access", () => {
    expect(roleAtLeast(["made_up_role"], "player")).toBe(false);
  });
});

describe("MockAuthStore roles", () => {
  it("grants and lists roles without duplicates", () => {
    const store = new MockAuthStore();
    const created = store.createUser("a@example.com", "password123");
    if (!created.ok) throw new Error("setup failed");
    expect(store.getRoles(created.user.id)).toEqual([]);
    store.grantRole(created.user.id, "editor");
    store.grantRole(created.user.id, "editor");
    expect(store.getRoles(created.user.id)).toEqual(["editor"]);
  });
});
