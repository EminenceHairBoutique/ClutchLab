"use client";

import { CONTROL_ELEMENTS } from "@clutchlab/content";
import { Badge, Button, Input, Label, cn } from "@clutchlab/ui";
import * as React from "react";
import { useActionState } from "react";

import { saveLayoutVersionAction, type ControlsFormState } from "@/app/controls/actions";
import { analyzeLayout, type PlacedElement } from "@/lib/controls/ergonomics";

const initialState: ControlsFormState = { error: null, ok: false };

const CATEGORY_COLOR: Record<string, string> = {
  movement: "border-info/60 bg-info/10 text-info",
  combat: "border-accent/60 bg-accent/10 text-accent",
  utility: "border-warning/60 bg-warning/10 text-warning",
  camera: "border-tier-d/60 bg-tier-d/10 text-tier-d",
  misc: "border-border-strong bg-surface-raised text-muted",
};

const elementMeta = new Map(CONTROL_ELEMENTS.map((e) => [e.slug, e]));

interface LayoutEditorProps {
  layoutId: string;
  initialPositions: PlacedElement[];
}

/**
 * Draggable HUD editor (spec §5.9). Original labeled shapes only — no game
 * assets. Live client-side ergonomic analysis re-runs on every change; saving
 * appends an immutable version with the server-computed analysis stored.
 */
export function LayoutEditor({ layoutId, initialPositions }: LayoutEditorProps) {
  const [positions, setPositions] = React.useState<PlacedElement[]>(initialPositions);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [state, formAction, pending] = useActionState(saveLayoutVersionAction, initialState);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef<string | null>(null);

  const analysis = React.useMemo(() => analyzeLayout(positions), [positions]);
  const selectedElement = positions.find((p) => p.slug === selected) ?? null;

  const updatePosition = React.useCallback((slug: string, patch: Partial<PlacedElement>) => {
    setPositions((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p)));
  }, []);

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent) => {
      const slug = dragging.current;
      const canvas = canvasRef.current;
      if (!slug || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
      updatePosition(slug, { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
    },
    [updatePosition],
  );

  return (
    <div className="space-y-4">
      <div
        ref={canvasRef}
        data-testid="layout-canvas"
        className="tactical-grid relative w-full touch-none select-none overflow-hidden rounded-xl border border-border bg-surface"
        style={{ aspectRatio: "16 / 9" }}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerLeave={() => {
          dragging.current = null;
        }}
      >
        {positions.map((position) => {
          const meta = elementMeta.get(position.slug);
          return (
            <button
              key={position.slug}
              type="button"
              aria-label={`${meta?.name ?? position.slug} control`}
              onPointerDown={(event) => {
                dragging.current = position.slug;
                setSelected(position.slug);
                event.preventDefault();
              }}
              className={cn(
                "absolute flex items-center justify-center rounded-full border text-center text-[9px] font-medium leading-tight",
                CATEGORY_COLOR[meta?.category ?? "misc"],
                selected === position.slug && "ring-2 ring-accent",
              )}
              style={{
                left: `${position.x * 100}%`,
                top: `${position.y * 100}%`,
                height: `${position.size * 100}%`,
                width: `${position.size * (9 / 16) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {meta?.name ?? position.slug}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant={analysis.score >= 80 ? "success" : analysis.score >= 60 ? "warning" : "danger"}>
          live ergonomics score {analysis.score}
        </Badge>
        {selectedElement && (
          <label className="flex items-center gap-2 text-xs text-muted">
            {elementMeta.get(selectedElement.slug)?.name} size
            <input
              type="range"
              min={0.04}
              max={0.2}
              step={0.005}
              value={selectedElement.size}
              onChange={(event) =>
                updatePosition(selectedElement.slug, { size: Number(event.target.value) })
              }
            />
          </label>
        )}
        <span className="text-xs text-faint">Drag any control; tap to select and resize.</span>
      </div>

      {analysis.findings.length > 0 && (
        <ul className="space-y-1.5">
          {analysis.findings.map((finding) => (
            <li
              key={finding.text}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs",
                finding.severity === "risk"
                  ? "border-danger/40 bg-danger/10 text-danger"
                  : finding.severity === "warn"
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-info/40 bg-info/10 text-info",
              )}
            >
              {finding.text}
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-3" noValidate>
        <input type="hidden" name="layoutId" value={layoutId} />
        <input type="hidden" name="positions" value={JSON.stringify(positions)} />
        {state.error ? (
          <p role="alert" className="w-full rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        {state.ok && !state.error ? (
          <p role="status" className="w-full rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            Saved as a new version.
          </p>
        ) : null}
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="layout-note">Version note</Label>
          <Input id="layout-note" name="note" maxLength={200} placeholder="What moved and why" />
        </div>
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving…" : "Save as new version"}
        </Button>
      </form>
    </div>
  );
}
