import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Explorer } from "./Explorer";
import { STUB_BADGE, STUB_PRIMARY_COPY } from "./stubConvention";

const schemaProps = {
  backendConfig: { baseUrl: "http://127.0.0.1:8000", bearerToken: "t" },
  connectedConnection: null as string | null,
  isBackendOnline: false,
  projectSchemaOverride: null as string | null,
  workingSchema: "",
  onWorkingSchemaChange: vi.fn(),
  onActivityRefresh: vi.fn(async () => undefined),
};

const baseProps = {
  rootPath: "C:/tmp/demo",
  showJunk: false,
  onToggleJunk: () => undefined,
  onOpenFile: () => undefined,
  schema: schemaProps,
  apexMappings: [] as ReadonlyArray<{ workspace_name: string; sqlcl_connection_name: string }>,
  onOpenApex: () => undefined,
};

describe("Explorer rail-driven postures", () => {
  it("hosts schema browsing under Database and stubs unfinished postures", () => {
    const { rerender } = render(<Explorer {...baseProps} activePosture="files" />);

    const explorer = screen.getByLabelText("Explorer navigation");
    expect(within(explorer).queryByLabelText("Schema browser")).not.toBeInTheDocument();

    rerender(<Explorer {...baseProps} activePosture="database" />);
    expect(within(explorer).getByLabelText("Schema browser")).toBeInTheDocument();

    rerender(<Explorer {...baseProps} activePosture="apex" />);
    expect(within(explorer).getByLabelText("APEX browser")).toBeInTheDocument();
    expect(within(explorer).getByTestId("stub-surface")).toBeInTheDocument();

    for (const posture of ["agent", "code", "review"] as const) {
      rerender(<Explorer {...baseProps} activePosture={posture} />);
      const stubSurface = within(explorer).getByTestId("stub-surface");
      expect(within(stubSurface).getByTestId("stub-badge")).toHaveTextContent(STUB_BADGE);
      expect(within(stubSurface).getByText(STUB_PRIMARY_COPY)).toBeInTheDocument();
      expect(within(stubSurface).queryByText(/\bGap\b/)).not.toBeInTheDocument();
      expect(within(stubSurface).queryByText(/\bDS-/)).not.toBeInTheDocument();
      expect(within(stubSurface).queryByText(/\bUI-\d+/)).not.toBeInTheDocument();
      expect(
        within(stubSurface).queryByText(/sample row|execution succeeded|mock timeline|EMPLOYEE|SELECT 1/i),
      ).not.toBeInTheDocument();
      const disabledActions = within(stubSurface).getAllByRole("button");
      expect(disabledActions.length).toBeGreaterThan(0);
      for (const action of disabledActions) {
        expect(action).toBeDisabled();
        expect(action).toHaveAttribute("title", STUB_PRIMARY_COPY);
      }
    }
  });

  it("keeps project files reachable from the Files posture", () => {
    render(<Explorer {...baseProps} activePosture="files" />);

    expect(screen.getByLabelText("Project file tree")).toBeInTheDocument();
  });

  it("opens mapped APEX workspaces from the APEX posture", () => {
    const onOpenApex = vi.fn();
    render(
      <Explorer
        {...baseProps}
        activePosture="apex"
        apexMappings={[{ workspace_name: "HR_WS", sqlcl_connection_name: "dev" }]}
        onOpenApex={onOpenApex}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /HR_WS/i }));
    expect(onOpenApex).toHaveBeenCalledWith({
      workspaceName: "HR_WS",
      connectionName: "dev",
    });
  });
});
