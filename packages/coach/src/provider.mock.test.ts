import { DRILLS } from "@clutchlab/content";
import { describe, expect, it } from "vitest";

import { MockCoachProvider } from "./provider.mock";
import { observationSchema, reportDraftSchema, type CoachContext } from "./types";

const context: CoachContext = {
  uploadKind: "clip",
  label: "Ranked Erangel final circle",
  durationSeconds: 90,
  frames: [],
};

describe("MockCoachProvider", () => {
  it("produces schema-valid observations, all labeled [MOCK] and unverified", async () => {
    const provider = new MockCoachProvider();
    const observations = await provider.extractObservations(context);
    expect(observations.length).toBeGreaterThanOrEqual(3);
    for (const o of observations) {
      expect(observationSchema.parse(o)).toBeTruthy();
      expect(o.observation).toContain("[MOCK]");
      expect(o.confidence).toBe("unverified");
    }
  });

  it("is deterministic for the same upload metadata", async () => {
    const provider = new MockCoachProvider();
    const a = await provider.extractObservations(context);
    const b = await provider.extractObservations(context);
    expect(a).toEqual(b);
    const differing = await provider.extractObservations({ ...context, label: "different label" });
    expect(differing).not.toEqual(a);
  });

  it("synthesizes a schema-valid report that admits it is a mock", async () => {
    const provider = new MockCoachProvider();
    const observations = await provider.extractObservations(context);
    const draft = await provider.synthesizeReport(context, observations);
    expect(reportDraftSchema.parse(draft)).toBeTruthy();
    expect(draft.executiveSummary).toContain("MOCK");
    expect(draft.confidence).toBe("unverified");
    expect(draft.couldNotDetermine.length).toBeGreaterThan(10);
    expect(draft.mistakes.length).toBeLessThanOrEqual(3);
  });

  it("recommends only drills that exist in the catalog", async () => {
    const provider = new MockCoachProvider();
    const known = new Set(DRILLS.map((d) => d.slug));
    const observations = await provider.extractObservations(context);
    const draft = await provider.synthesizeReport(context, observations);
    expect(draft.drillSlugs.length).toBeGreaterThan(0);
    for (const slug of draft.drillSlugs) {
      expect(known.has(slug), `unknown drill slug: ${slug}`).toBe(true);
    }
  });

  it("never claims zero recoil or guaranteed outcomes", async () => {
    const provider = new MockCoachProvider();
    const observations = await provider.extractObservations(context);
    const draft = await provider.synthesizeReport(context, observations);
    const allText = JSON.stringify({ observations, draft }).toLowerCase();
    expect(allText).not.toContain("zero recoil");
    expect(allText).not.toContain("guaranteed");
  });
});
