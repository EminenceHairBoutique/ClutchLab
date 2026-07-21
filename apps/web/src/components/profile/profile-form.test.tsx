import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/profile/actions", () => ({
  saveProfileAction: vi.fn(async () => ({ error: null, saved: true })),
}));

import { ProfileForm } from "./profile-form";

const emptyValues = {
  displayName: null,
  handle: null,
  region: null,
  fingerCount: null,
  gripStyle: null,
  gyroMode: null,
  aimAssistPref: null,
  primaryDeviceId: null,
};

describe("ProfileForm", () => {
  it("renders all Phase 1 fields with labels", () => {
    render(
      <ProfileForm
        values={emptyValues}
        devices={[{ id: "d1", label: "Test Phone", dataStatus: "sample" }]}
      />,
    );
    for (const label of [
      "Display name",
      "Handle",
      "Edition / region",
      "Primary device",
      "Finger count",
      "Grip style",
      "Gyroscope",
      "Aim assist preference",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
  });

  it("shows device options with their data status (never silently verified)", () => {
    render(
      <ProfileForm
        values={emptyValues}
        devices={[{ id: "d1", label: "Test Phone", dataStatus: "sample" }]}
      />,
    );
    expect(screen.getByRole("option", { name: "Test Phone (sample)" })).toBeInTheDocument();
  });

  it("pre-fills existing values", () => {
    render(
      <ProfileForm
        values={{ ...emptyValues, displayName: "Clutch", fingerCount: 4 }}
        devices={[]}
      />,
    );
    expect(screen.getByLabelText("Display name")).toHaveValue("Clutch");
    expect(screen.getByLabelText("Finger count")).toHaveValue("4");
  });
});
