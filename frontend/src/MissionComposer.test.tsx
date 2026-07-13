import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MissionComposer } from "./MissionComposer";
import { STUB_ACTION_CLASS, STUB_BADGE, STUB_PRIMARY_COPY } from "./stubConvention";

describe("Mission timeline and empty-state collapse (#33 / #97)", () => {
  it("exposes timeline, mission card, plan/SQL/review/exec stages, and history layout", () => {
    render(<MissionComposer projectName="demo" />);

    const surface = screen.getByTestId("mission-surface");
    expect(surface).toHaveClass("mission-surface");
    expect(within(surface).getByLabelText("Mission timeline")).toBeInTheDocument();
    expect(within(surface).getByLabelText("Mission card")).toBeInTheDocument();
    expect(within(surface).getByLabelText("Mission history")).toBeInTheDocument();

    const stages = within(surface).getByLabelText("Mission stages");
    for (const name of ["Plan", "SQL", "Review", "Exec"]) {
      expect(within(stages).getByText(name)).toBeInTheDocument();
    }

    expect(within(surface).getByLabelText("Mission composer")).toBeInTheDocument();
  });

  it("collapses history to one empty line until Agent Core (H5)", () => {
    render(<MissionComposer projectName="demo" />);

    const history = screen.getByLabelText("Mission history");
    expect(within(history).getByTestId("stub-badge")).toHaveTextContent(STUB_BADGE);
    expect(within(history).getByText("No missions yet")).toBeInTheDocument();
    expect(within(history).queryAllByText("No missions yet")).toHaveLength(1);
    for (const bucket of ["Recent", "Today", "Yesterday", "Earlier"]) {
      expect(within(history).queryByText(bucket)).not.toBeInTheDocument();
    }
  });

  it("uses Stub honesty for unfinished Mission chrome without fake success timelines", () => {
    render(<MissionComposer projectName="demo" />);

    const surface = screen.getByTestId("mission-surface");
    expect(within(surface).getAllByTestId("stub-badge").length).toBeGreaterThan(0);
    expect(within(surface).getAllByText(STUB_PRIMARY_COPY).length).toBeGreaterThan(0);
    expect(within(surface).getAllByText(STUB_BADGE).length).toBeGreaterThan(0);

    expect(surface).not.toHaveTextContent(/\bGap\b/);
    expect(surface).not.toHaveTextContent(/\bDS-/);
    expect(surface).not.toHaveTextContent(/\bUI-\d+/);
    expect(surface).not.toHaveTextContent(
      /sample row|execution succeeded|mock timeline|streaming|Completed|18 Statements|10:42/i,
    );

    const send = within(surface).getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    expect(send).toHaveClass(STUB_ACTION_CLASS);
    expect(send).toHaveAttribute("title", STUB_PRIMARY_COPY);
  });
});
