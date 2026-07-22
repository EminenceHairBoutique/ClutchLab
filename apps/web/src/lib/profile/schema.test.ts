// @vitest-environment node
import { describe, expect, it } from "vitest";

import { emptyToNull, profileSchema } from "./schema";

const base = {
  displayName: null,
  handle: null,
  region: null,
  primaryDeviceId: null,
  fingerCount: null,
  gripStyle: null,
  gyroMode: null,
  aimAssistPref: null,
};

describe("profileSchema", () => {
  it("accepts an all-null profile (every field optional)", () => {
    expect(profileSchema.parse(base)).toEqual(base);
  });

  it("accepts a fully populated profile and coerces finger count", () => {
    const parsed = profileSchema.parse({
      ...base,
      displayName: "Clutch",
      handle: "clutch_99",
      region: "global",
      fingerCount: "4",
      gripStyle: "claw_4",
      gyroMode: "always_on",
      aimAssistPref: "off",
    });
    expect(parsed.fingerCount).toBe(4);
    expect(parsed.gripStyle).toBe("claw_4");
  });

  it("rejects invalid handles", () => {
    expect(profileSchema.safeParse({ ...base, handle: "Bad Handle!" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, handle: "ab" }).success).toBe(false);
  });

  it("rejects out-of-range finger counts", () => {
    expect(profileSchema.safeParse({ ...base, fingerCount: "1" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, fingerCount: "7" }).success).toBe(false);
  });

  it("rejects unknown enum values", () => {
    expect(profileSchema.safeParse({ ...base, region: "mars" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, gyroMode: "sometimes" }).success).toBe(false);
  });
});

describe("emptyToNull", () => {
  it("maps empty/whitespace strings and non-strings to null", () => {
    expect(emptyToNull("")).toBeNull();
    expect(emptyToNull("   ")).toBeNull();
    expect(emptyToNull(null)).toBeNull();
    expect(emptyToNull("value")).toBe("value");
  });
});
