import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Label } from "./label";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./sheet";
import { Skeleton } from "./skeleton";
import { Stat } from "./stat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { TierBadge, TIERS } from "./tier-badge";

describe("Button", () => {
  it("renders as a button by default", () => {
    render(<Button>Calibrate</Button>);
    expect(screen.getByRole("button", { name: "Calibrate" })).toBeInTheDocument();
  });

  it("renders its child element with asChild", () => {
    render(
      <Button asChild>
        <a href="/meta">Open meta</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Open meta" })).toHaveAttribute("href", "/meta");
  });

  it("respects disabled", () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("TierBadge", () => {
  it("renders every tier with a visible letter and accessible name", () => {
    render(
      <div>
        {TIERS.map((tier) => (
          <TierBadge key={tier} tier={tier} />
        ))}
      </div>,
    );
    for (const tier of TIERS) {
      const el = screen.getByLabelText(`Tier ${tier}`);
      expect(el).toHaveTextContent(tier);
    }
  });
});

describe("Card", () => {
  it("renders title, description, and content", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Version 4.5</CardTitle>
          <CardDescription>Current game version</CardDescription>
        </CardHeader>
        <CardContent>Patch highlights</CardContent>
      </Card>,
    );
    expect(screen.getByRole("heading", { name: "Version 4.5" })).toBeInTheDocument();
    expect(screen.getByText("Current game version")).toBeInTheDocument();
    expect(screen.getByText("Patch highlights")).toBeInTheDocument();
  });
});

describe("Input + Label", () => {
  it("associates the label with the input", () => {
    render(
      <div>
        <Label htmlFor="handle">Handle</Label>
        <Input id="handle" placeholder="your-handle" />
      </div>,
    );
    expect(screen.getByLabelText("Handle")).toHaveAttribute("placeholder", "your-handle");
  });
});

describe("Tabs", () => {
  it("switches panels on click", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="ranked">
        <TabsList>
          <TabsTrigger value="ranked">Ranked</TabsTrigger>
          <TabsTrigger value="ultimate">Ultimate Royale</TabsTrigger>
        </TabsList>
        <TabsContent value="ranked">Ranked content</TabsContent>
        <TabsContent value="ultimate">UR content</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText("Ranked content")).toBeVisible();
    expect(screen.queryByText("UR content")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Ultimate Royale" }));
    expect(screen.getByText("UR content")).toBeVisible();
  });
});

describe("Sheet", () => {
  it("opens on trigger click and exposes a dialog with title", async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>More</SheetTrigger>
        <SheetContent>
          <SheetTitle>All destinations</SheetTitle>
          <SheetDescription>Navigate anywhere</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("dialog", { name: "All destinations" })).toBeInTheDocument();
  });
});

describe("Badge / Skeleton / Stat", () => {
  it("renders badge text", () => {
    render(<Badge variant="accent">verified</Badge>);
    expect(screen.getByText("verified")).toBeInTheDocument();
  });

  it("skeleton is hidden from assistive tech", () => {
    const { container } = render(<Skeleton data-testid="sk" />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("stat renders value with unit", () => {
    render(<Stat value={120} unit="fps" />);
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("fps")).toBeInTheDocument();
  });
});
