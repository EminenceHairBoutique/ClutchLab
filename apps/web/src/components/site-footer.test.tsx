import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("shows the independent-product disclaimer", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/independent training companion/i)).toBeInTheDocument();
    expect(screen.getByText(/not affiliated with/i)).toBeInTheDocument();
  });

  it("states the no-automation, post-match-only policy", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/no gameplay automation/i)).toBeInTheDocument();
    expect(screen.getByText(/post-match only/i)).toBeInTheDocument();
  });
});
