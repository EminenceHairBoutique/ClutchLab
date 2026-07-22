"use client";

import {
  CALIBRATION_STEPS,
  currentStep,
  flowComplete,
  recommend,
  startFlow,
  submitOutcome,
  type CalibrationOutcome,
  type FlowState,
  type SensitivityValues,
} from "@clutchlab/calibration";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import { useRouter } from "next/navigation";
import * as React from "react";

import { saveCalibrationAction } from "@/app/settings/actions";

const OUTCOME_LABEL: Record<CalibrationOutcome, string> = {
  overshoot: "Overshot / too fast",
  undershoot: "Undershot / too slow",
  on_target: "On target",
  unstable: "Spread grew / unstable",
  stable: "Stable",
};

interface CalibrationWizardProps {
  profileId: string;
  initialValues: SensitivityValues;
}

/**
 * Client-side runner for the §5.7 guided flow. The whole session commits as a
 * single new profile version at the end; per-step results and recommendations
 * persist server-side. One variable changes at a time — enforced by the flow.
 */
export function CalibrationWizard({ profileId, initialValues }: CalibrationWizardProps) {
  const router = useRouter();
  const [state, setState] = React.useState<FlowState>(() => startFlow(initialValues));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const step = currentStep(state);
  const done = flowComplete(state);

  async function finish() {
    setSaving(true);
    setError(null);
    const result = await saveCalibrationAction({
      profileId,
      values: state.values,
      results: state.results,
      adjustments: state.adjustments,
    });
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.push(`/settings/sensitivity/${profileId}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="font-mono tabular-nums">
          {Math.min(state.stepIndex + 1, CALIBRATION_STEPS.length)}/{CALIBRATION_STEPS.length}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
          <div
            className="h-full rounded-full bg-accent/70 transition-all"
            style={{ width: `${(state.stepIndex / CALIBRATION_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!done && step && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{step.name}</CardTitle>
              {step.adjusts && <Badge variant="outline">adjusts {step.adjusts.family}</Badge>}
            </div>
            <CardDescription>{step.instructions}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {step.outcomes.map((outcome) => (
              <Button
                key={outcome}
                variant={outcome === "on_target" || outcome === "stable" ? "accent" : "outline"}
                onClick={() => setState((s) => submitOutcome(s, outcome))}
              >
                {OUTCOME_LABEL[outcome]}
              </Button>
            ))}
          </CardContent>
          {step.adjusts && (
            <CardContent className="pt-0 text-xs text-faint">
              {recommend(step, step.outcomes.find((o) => o !== "on_target" && o !== "stable") ?? "on_target").rationale}
            </CardContent>
          )}
        </Card>
      )}

      {done && (
        <Card>
          <CardHeader>
            <CardTitle>Calibration complete</CardTitle>
            <CardDescription>
              {state.adjustments.length === 0
                ? "No adjustments were needed — your current values held up across every test."
                : `${state.adjustments.length} adjustment${state.adjustments.length === 1 ? "" : "s"} will be saved as a new version:`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.adjustments.length > 0 && (
              <ul className="space-y-1 text-sm text-muted">
                {state.adjustments.map((adj) => (
                  <li key={`${adj.step}-${adj.key}`} className="font-mono tabular-nums">
                    {adj.key}: {adj.from} → {adj.to}
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={finish} variant="accent" disabled={saving}>
              {saving ? "Saving…" : "Save as new version"}
            </Button>
          </CardContent>
        </Card>
      )}

      {state.adjustments.length > 0 && !done && (
        <p className="text-xs text-faint">
          Adjustments so far:{" "}
          {state.adjustments.map((a) => `${a.key} ${a.from}→${a.to}`).join(" · ")}
        </p>
      )}
    </div>
  );
}
