// @vitest-environment node
import { describe, expect, it } from "vitest";

import { checkContentRisk } from "./risk-flags";

describe("checkContentRisk", () => {
  it("flags each prohibited category (spec §5.16)", () => {
    const cases: Array<[string, RegExp]> = [
      ["Get this aimbot now", /cheat/],
      ["best recoil script for 4.5", /macro/],
      ["download my modded apk", /modified client/],
      ["selling my account cheap", /account trading/],
      ["UC cheap top-up deal here", /UC scam/],
      ["send me your password to boost you", /credential/],
      ["I am officially verified, trust the settings", /verification claim/],
    ];
    for (const [text, reason] of cases) {
      const result = checkContentRisk(text);
      expect(result.flagged, text).toBe(true);
      expect(result.reason, text).toMatch(reason);
    }
  });

  it("passes normal community content", () => {
    const clean = [
      "My 3× spray finally stabilized after moving to claw",
      "Is the ACE32 worth main-ing after the 4.5 change?",
      "Looking for a duo partner, EU evenings, Crown+",
      "The no recoil myth is nonsense — here's my test",
    ];
    for (const text of clean) {
      expect(checkContentRisk(text).flagged, text).toBe(false);
    }
  });
});
