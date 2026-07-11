import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeveloperConsole } from "./DeveloperConsole";
import type { ActivityEntry } from "./backend";

const sampleEntries: ActivityEntry[] = [
  {
    sequence: 1,
    timestamp: "2026-07-09T18:00:00+00:00",
    tool_name: "connections_list",
    arguments: {},
    status: "succeeded",
    message: null,
    connection_name: "dev",
    session_id: "session-1",
  },
];

afterEach(() => {
  cleanup();
});

describe("DeveloperConsole MCP Activity tab", () => {
  it("renders live MCP activity in the MCP Activity tab instead of Stub chrome", () => {
    render(
      <DeveloperConsole
        entries={sampleEntries}
        connectionName="dev"
        activeSessionId="session-1"
      />,
    );

    const tabs = screen.getByRole("tablist", { name: "Developer Console tabs" });
    fireEvent.click(within(tabs).getByRole("tab", { name: "MCP Activity" }));

    const panel = screen.getByRole("tabpanel");
    expect(panel).not.toHaveTextContent("Stub");
    expect(panel).not.toHaveTextContent("Not implemented yet");
    expect(within(panel).getByLabelText("MCP tool activity")).toBeInTheDocument();
    expect(within(panel).getByText("connections_list")).toBeInTheDocument();
  });

  it("selects the MCP Activity tab when a focus request arrives", () => {
    const onMcpFocusHandled = vi.fn();
    const { rerender } = render(
      <DeveloperConsole
        entries={[]}
        connectionName={null}
        activeSessionId={null}
        mcpFocusRequest={0}
        onMcpFocusHandled={onMcpFocusHandled}
      />,
    );

    expect(screen.getByRole("tab", { name: "Problems" })).toHaveAttribute("aria-selected", "true");

    rerender(
      <DeveloperConsole
        entries={[]}
        connectionName={null}
        activeSessionId={null}
        mcpFocusRequest={1}
        onMcpFocusHandled={onMcpFocusHandled}
      />,
    );

    expect(screen.getByRole("tab", { name: "MCP Activity" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/not connected to a database/i);
    expect(screen.getByRole("tabpanel")).not.toHaveTextContent("Stub");
    expect(onMcpFocusHandled).toHaveBeenCalled();
  });

  it("keeps unfinished tabs on Stub conventions", () => {
    render(
      <DeveloperConsole entries={[]} connectionName={null} activeSessionId={null} />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Output" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Stub");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Not implemented yet");
  });
});
