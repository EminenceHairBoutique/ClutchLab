import { describe, expect, it } from "vitest";

import { BOTTOM_NAV_HREFS, DESTINATIONS, destinationFor } from "./navigation";

describe("navigation IA", () => {
  it("contains exactly the 11 spec §4 destinations", () => {
    expect(DESTINATIONS.map((d) => d.title)).toEqual([
      "Home",
      "Meta",
      "Weapons",
      "Settings",
      "Controls",
      "Training",
      "Coach",
      "Maps",
      "Pros",
      "Community",
      "Profile",
    ]);
  });

  it("bottom bar is the spec-recommended five", () => {
    expect(BOTTOM_NAV_HREFS).toEqual(["/", "/meta", "/training", "/coach", "/profile"]);
  });

  it("every bottom-bar item is a real destination", () => {
    for (const href of BOTTOM_NAV_HREFS) {
      expect(destinationFor(href)).toBeDefined();
    }
  });

  it("hrefs are unique", () => {
    const hrefs = DESTINATIONS.map((d) => d.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
