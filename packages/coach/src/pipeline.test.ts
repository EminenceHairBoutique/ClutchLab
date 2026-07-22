import { describe, expect, it } from "vitest";

import { CoachPipelineError, runAnalysis } from "./pipeline";
import { MockCoachProvider } from "./provider.mock";
import type { CoachContext, CoachProvider, Observation, ReportDraft } from "./types";

const context: CoachContext = {
  uploadKind: "clip",
  label: "TDM warmup",
  durationSeconds: 120,
  frames: [],
};

const validObservation: Observation = {
  tSeconds: 10,
  category: "recoil",
  observation: "Spray drifted right after the tenth bullet.",
  inference: false,
  confidence: "medium",
};

const validDraft: ReportDraft = {
  executiveSummary: "Spray length management is the recurring theme in this recording.",
  mistakes: [
    {
      tSeconds: 10,
      what: "Committed to a full-magazine spray at mid range.",
      whyItMattered: "The late-magazine spread turned a likely knock into misses.",
      betterAlternative: "Cut to 8-12 round bursts and reset between them.",
    },
  ],
  drillSlugs: ["burst_grouping"],
  settingsNote: null,
  couldNotDetermine: "Hit registration cannot be verified from this recording.",
  confidence: "medium",
};

function stubProvider(overrides: Partial<CoachProvider>): CoachProvider {
  return {
    modelId: "stub-model",
    promptVersion: "stub-v1",
    extractObservations: async () => [validObservation],
    synthesizeReport: async () => validDraft,
    ...overrides,
  };
}

describe("runAnalysis", () => {
  it("runs the two passes and stamps model id + prompt version", async () => {
    const result = await runAnalysis(new MockCoachProvider(), context);
    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.draft.mistakes.length).toBeGreaterThan(0);
    expect(result.modelId).toBe("mock-coach");
    expect(result.promptVersion).toBe("coach-v1");
  });

  it("fails honestly when the provider observes nothing", async () => {
    const provider = stubProvider({ extractObservations: async () => [] });
    await expect(runAnalysis(provider, context)).rejects.toThrowError(CoachPipelineError);
    await expect(runAnalysis(provider, context)).rejects.toThrow(/no observations/i);
  });

  it("rejects invalid observations from a misbehaving provider", async () => {
    const provider = stubProvider({
      extractObservations: async () =>
        [{ ...validObservation, tSeconds: -5 }] as unknown as Observation[],
    });
    await expect(runAnalysis(provider, context)).rejects.toThrow(/invalid observations/i);
  });

  it("rejects a report with more than three mistakes", async () => {
    const provider = stubProvider({
      synthesizeReport: async () =>
        ({
          ...validDraft,
          mistakes: Array.from({ length: 4 }, () => validDraft.mistakes[0]),
        }) as unknown as ReportDraft,
    });
    await expect(runAnalysis(provider, context)).rejects.toThrow(/invalid report/i);
  });

  it("drops drill slugs that are not in the catalog and reports them", async () => {
    const provider = stubProvider({
      synthesizeReport: async () => ({
        ...validDraft,
        drillSlugs: ["burst_grouping", "made_up_drill"],
      }),
    });
    const result = await runAnalysis(provider, context);
    expect(result.draft.drillSlugs).toEqual(["burst_grouping"]);
    expect(result.unknownDrillSlugs).toEqual(["made_up_drill"]);
  });
});
