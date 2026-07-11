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

describe("Explorer multi-section + schema home", () => {
  it("exposes Files, Database, APEX, REST, Favorites, Pinned, and Recent sections", () => {
    render(
      <Explorer
        rootPath="C:/tmp/demo"
        showJunk={false}
        onToggleJunk={() => undefined}
        onOpenFile={() => undefined}
        schema={schemaProps}
      />,
    );

    const explorer = screen.getByRole("navigation", { name: "Explorer sections" });
    for (const name of ["Files", "Database", "APEX", "REST", "Favorites", "Pinned", "Recent"]) {
      expect(within(explorer).getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("hosts schema browsing under Database and stubs unfinished sections", () => {
    render(
      <Explorer
        rootPath="C:/tmp/demo"
        showJunk={false}
        onToggleJunk={() => undefined}
        onOpenFile={() => undefined}
        schema={schemaProps}
      />,
    );

    const explorer = screen.getByLabelText("Explorer navigation");
    expect(within(explorer).queryByLabelText("Schema browser")).not.toBeInTheDocument();

    fireEvent.click(within(explorer).getByRole("button", { name: "Database" }));
    expect(within(explorer).getByLabelText("Schema browser")).toBeInTheDocument();

    for (const name of ["APEX", "REST", "Favorites", "Pinned", "Recent"]) {
      fireEvent.click(within(explorer).getByRole("button", { name }));
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

  it("keeps project files reachable from the Files section", () => {
    render(
      <Explorer
        rootPath="C:/tmp/demo"
        showJunk={false}
        onToggleJunk={() => undefined}
        onOpenFile={() => undefined}
        schema={schemaProps}
      />,
    );

    const explorer = screen.getByLabelText("Explorer navigation");
    fireEvent.click(within(explorer).getByRole("button", { name: "Files" }));
    expect(within(explorer).getByLabelText("Project file tree")).toBeInTheDocument();
    expect(within(explorer).getByText("Show junk")).toBeInTheDocument();
  });
});
