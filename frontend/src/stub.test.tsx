import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StubBadge, StubMessage, StubSurface } from "./StubSurface";
import {
  STUB_BADGE,
  STUB_PRIMARY_COPY,
  containsForbiddenStubUiCopy,
  stubActionProps,
} from "./stubConvention";

describe("stub convention (ADR-0007 §11)", () => {
  it("exposes exact Stub badge and primary copy constants", () => {
    expect(STUB_BADGE).toBe("Stub");
    expect(STUB_PRIMARY_COPY).toBe("Not implemented yet");
  });

  it("renders Stub badge and primary copy for unfinished surfaces", () => {
    render(
      <StubSurface
        title="Developer Console"
        secondary="Console tabs need the Developer Console ticket."
      />,
    );

    expect(screen.getByTestId("stub-badge")).toHaveTextContent("Stub");
    expect(screen.getByText("Not implemented yet")).toBeInTheDocument();
    expect(
      screen.getByText("Console tabs need the Developer Console ticket."),
    ).toBeInTheDocument();
    expect(screen.getByText("Developer Console")).toBeInTheDocument();
  });

  it("disables stubbed actions and never fakes a successful run", () => {
    const props = stubActionProps();
    render(
      <StubSurface
        title="Toolbar stubs"
        actions={
          <button type="button" className="chrome-button" {...props}>
            Run
          </button>
        }
      />,
    );

    const run = screen.getByRole("button", { name: "Run" });
    expect(run).toBeDisabled();
    expect(run).toHaveAttribute("title", "Not implemented yet");
    expect(screen.queryByText(/success|completed|1 row|mock timeline/i)).not.toBeInTheDocument();
  });

  it("does not render sample rows, fake SQL results, or mock success timelines", () => {
    const { container } = render(<StubSurface title="Mission composer" />);
    expect(container.querySelectorAll("table, tbody, pre.sql-result").length).toBe(0);
    expect(screen.queryByText(/sample row|SELECT 1|execution succeeded/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("stub-message").textContent).toBe("Not implemented yet");
  });

  it("rejects Gap markings and DS-* / UI-* planning IDs in secondary copy", () => {
    expect(containsForbiddenStubUiCopy("Gap: DS-CONSOLE-tabs")).toBe(true);
    expect(containsForbiddenStubUiCopy("See UI-6")).toBe(true);
    expect(containsForbiddenStubUiCopy("Console tabs need a later ticket.")).toBe(false);

    expect(() =>
      render(<StubMessage secondary="Blocked on UI-6 / DS-CONSOLE-mcp" />),
    ).toThrow(/planning IDs/i);
    expect(() => stubActionProps("See UI-6")).toThrow(/planning IDs/i);
  });

  it("renders StubBadge alone for chrome that already owns layout", () => {
    render(
      <div>
        <strong>Problems</strong>
        <StubBadge />
      </div>,
    );
    expect(screen.getByTestId("stub-badge")).toHaveTextContent("Stub");
  });
});
