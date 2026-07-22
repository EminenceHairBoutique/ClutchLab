import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DESTINATIONS } from "@/lib/navigation";

import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  it("renders the five thumb-reach items plus More", () => {
    render(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const label of ["Home", "Meta", "Train", "Coach", "Profile"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("button", { name: "More destinations" })).toBeInTheDocument();
  });

  it("marks the active route with aria-current", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Meta" })).not.toHaveAttribute("aria-current");
  });

  it("exposes all 11 destinations in the More sheet", async () => {
    const user = userEvent.setup();
    render(<BottomNav />);
    await user.click(screen.getByRole("button", { name: "More destinations" }));
    const dialog = screen.getByRole("dialog", { name: "All destinations" });
    for (const destination of DESTINATIONS) {
      expect(
        within(dialog).getByRole("link", { name: new RegExp(`^${destination.title}`) }),
      ).toHaveAttribute("href", destination.href);
    }
  });
});
