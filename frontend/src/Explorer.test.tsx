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

describe("Explorer rail-driven postures", () => {
  it("hosts schema browsing under Database and stubs unfinished postures", () => {
    const { rerender } = render(
      <Explorer
        rootPath="C:/tmp/demo"
        showJunk={false}
        onToggleJunk={() => undefined}
        onOpenFile={() => undefined}
        schema={schemaProps}
        activePosture="files"
      />,
    );

    const explorer = screen.getByLabelText("Explorer navigation");
    expect(within(explorer).queryByLabelText("Schema browser")).not.toBeInTheDocument();

    rerender(
      <Explorer
        rootPath="C:/tmp/demo"
        showJunk={false}
        onToggleJunk={() => undefined}
        onOpenFile={() => undefined}
        schema={schemaProps}
        activePosture="database"
      />,
    );
    expect(within(explorer).getByLabelText("Schema browser")).toBeInTheDocument();

    for (const posture of ["agent", "code", "apex", "review"] as const) {
      rerender(
        <Explorer
          rootPath="C:/tmp/demo"
          showJunk={false}
          onToggleJunk={() => undefined}
          onOpenFile={() => undefined}
          schema={schemaProps}
          activePosture={posture}
        />,
      );
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
    render(
      <Explorer
        rootPath="C:/tmp/demo"
        showJunk={false}
        onToggleJunk={() => undefined}
        onOpenFile={() => undefined}
        schema={schemaProps}
        activePosture="files"
      />,
    );

    expect(screen.getByLabelText("Project file tree")).toBeInTheDocument();
  });
});
