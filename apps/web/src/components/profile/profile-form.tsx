"use client";

import { Badge, Button, Input, Label, cn } from "@clutchlab/ui";
import { useActionState } from "react";

import { saveProfileAction, type ProfileFormState } from "@/app/profile/actions";
import type { DeviceOption, ProfileFormValues } from "@/lib/data/profile-store";

const initialState: ProfileFormState = { error: null, saved: false };

const selectClass =
  "flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

const REGIONS = [
  { value: "global", label: "Global" },
  { value: "kr_jp", label: "KR / JP" },
  { value: "vn", label: "Vietnam" },
  { value: "tw", label: "Taiwan" },
  { value: "bgmi", label: "BGMI (India)" },
  { value: "other", label: "Other" },
];

const GRIPS = [
  { value: "thumbs", label: "Two thumbs" },
  { value: "claw_3", label: "3-finger claw" },
  { value: "claw_4", label: "4-finger claw" },
  { value: "claw_5", label: "5-finger claw" },
  { value: "claw_6", label: "6-finger claw" },
  { value: "hybrid", label: "Hybrid" },
  { value: "other", label: "Other" },
];

const GYRO_MODES = [
  { value: "off", label: "Off" },
  { value: "scope_on", label: "Scope-on only" },
  { value: "always_on", label: "Always on" },
];

const AIM_ASSIST = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
  { value: "mixed", label: "Mixed / training both" },
  { value: "undecided", label: "Not sure yet" },
];

interface ProfileFormProps {
  values: ProfileFormValues;
  devices: DeviceOption[];
}

export function ProfileForm({ values, devices }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(saveProfileAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.saved && !state.error ? (
        <p role="status" className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Profile saved.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={values.displayName ?? ""}
            maxLength={40}
            placeholder="How you want to appear"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="handle">Handle</Label>
          <Input
            id="handle"
            name="handle"
            defaultValue={values.handle ?? ""}
            placeholder="lowercase_handle"
            pattern="[a-z0-9_]{3,20}"
          />
          <p className="text-xs text-faint">3–20 characters: a–z, 0–9, underscore.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="region">Edition / region</Label>
          <select id="region" name="region" defaultValue={values.region ?? ""} className={selectClass}>
            <option value="">Not set</option>
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="primaryDeviceId">Primary device</Label>
          <select
            id="primaryDeviceId"
            name="primaryDeviceId"
            defaultValue={values.primaryDeviceId ?? ""}
            className={selectClass}
          >
            <option value="">Not set</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
                {d.dataStatus !== "verified" ? ` (${d.dataStatus})` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-faint">
            Device entries show their verification status; calibration can override any inferred
            value.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fingerCount">Finger count</Label>
          <select
            id="fingerCount"
            name="fingerCount"
            defaultValue={values.fingerCount?.toString() ?? ""}
            className={selectClass}
          >
            <option value="">Not set</option>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} fingers
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gripStyle">Grip style</Label>
          <select
            id="gripStyle"
            name="gripStyle"
            defaultValue={values.gripStyle ?? ""}
            className={selectClass}
          >
            <option value="">Not set</option>
            {GRIPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gyroMode">Gyroscope</Label>
          <select
            id="gyroMode"
            name="gyroMode"
            defaultValue={values.gyroMode ?? ""}
            className={selectClass}
          >
            <option value="">Not set</option>
            {GYRO_MODES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aimAssistPref">Aim assist preference</Label>
          <select
            id="aimAssistPref"
            name="aimAssistPref"
            defaultValue={values.aimAssistPref ?? ""}
            className={selectClass}
          >
            <option value="">Not set</option>
            {AIM_ASSIST.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-faint">
            Unsure? The Aim Assist Decision Lab (Phase 3) runs a structured on/off test instead of
            guessing.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="accent" disabled={pending} className={cn(pending && "opacity-70")}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
        <Badge variant="outline">All fields optional</Badge>
      </div>
    </form>
  );
}
