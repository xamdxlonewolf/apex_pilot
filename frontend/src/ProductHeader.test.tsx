import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BrowserAppMenu } from "./BrowserAppMenu";
import { ProductHeader } from "./ProductHeader";
import { defaultProfileLayout } from "./prefs";
import type { AppMenuHandlers, AppMenuState } from "./appMenuModel";
import type { OpenedProject } from "./backend";

const baseHandlers = (): AppMenuHandlers => ({
  onNewProject: vi.fn(),
  onOpenProject: vi.fn(),
  onRecentProjects: vi.fn(),
  onCloseProject: vi.fn(),
  onSettings: vi.fn(),
  onOpenMcp: vi.fn(),
  onTogglePanel: vi.fn(),
  onFocusMode: vi.fn(),
  onAbout: vi.fn(),
  onDocs: vi.fn(),
  onShortcuts: vi.fn(),
  onUpdates: vi.fn(),
  onCompareProjectToDatabase: vi.fn(),
});

const baseState = (): AppMenuState => ({
  canUseProjectMenus: true,
  canOpenSettings: true,
  canOpenMcp: true,
  canTogglePanels: true,
  canCloseProject: true,
  canCompareProjectToDatabase: true,
  projectOpen: true,
  focusMode: "agent",
  layout: defaultProfileLayout(),
  mcpActivityCount: 0,
});

const openedProject = (): OpenedProject =>
  ({
    project: {
      project_id: "proj-1",
      profile_id: "profile-1",
      name: "Demo",
      root_path: "C:/tmp/demo",
      retention_days: 365,
      created_at: "2026-07-09T00:00:00+00:00",
      updated_at: "2026-07-09T00:00:00+00:00",
    },
    manifest: {
      defaultEnvironment: "dev",
      environments: [{ name: "dev", defaultSchema: "HR" }],
    },
    environment_mappings: [],
    apex_workspace_mappings: [],
    unmapped_environments: ["dev"],
    preflight: { ready: true, blocking_ids: [], checks: [] },
  }) as OpenedProject;

describe("BrowserAppMenu", () => {
  it("shows only File Edit View Help until a top-level menu is opened", () => {
    render(<BrowserAppMenu state={baseState()} handlers={baseHandlers()} />);

    expect(screen.getByRole("menuitem", { name: "File" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Help" })).toBeInTheDocument();

    expect(screen.queryByRole("menuitem", { name: "New…" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Check for updates/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens Help on click and routes Check for updates", () => {
    const handlers = baseHandlers();
    render(<BrowserAppMenu state={baseState()} handlers={handlers} />);

    fireEvent.click(screen.getByRole("menuitem", { name: "Help" }));
    expect(screen.getByRole("menu", { name: "Help" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /Check for updates/i }));
    expect(handlers.onUpdates).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("does not open top-level menus on hover", () => {
    render(<BrowserAppMenu state={baseState()} handlers={baseHandlers()} />);

    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: "File" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape and outside click", () => {
    render(<BrowserAppMenu state={baseState()} handlers={baseHandlers()} />);

    fireEvent.click(screen.getByRole("menuitem", { name: "File" }));
    expect(screen.getByRole("menu", { name: "File" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(screen.getByRole("menu", { name: "Edit" })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("routes Compare project to database when enabled", () => {
    const handlers = baseHandlers();
    render(<BrowserAppMenu state={baseState()} handlers={handlers} />);

    fireEvent.click(screen.getByRole("menuitem", { name: "Help" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Compare project to database/i }));
    expect(handlers.onCompareProjectToDatabase).toHaveBeenCalled();
  });

  it("disables Compare project to database without project and connection", () => {
    const handlers = baseHandlers();
    render(
      <BrowserAppMenu
        state={{ ...baseState(), canCompareProjectToDatabase: false }}
        handlers={handlers}
      />,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Help" }));
    expect(screen.getByRole("menuitem", { name: /Compare project to database/i })).toBeDisabled();
  });
});

describe("ProductHeader", () => {
  it("hosts Context Bar role with Connect and Settings gear", () => {
    const onOpenSettings = vi.fn();
    const onConnect = vi.fn();
    render(
      <ProductHeader
        openedProject={openedProject()}
        backendStatus={{
          kind: "online",
          baseUrl: "http://127.0.0.1:8000",
          health: { status: "ok", service: "apex-pilot-backend", version: "0.1.0" },
        }}
        isBackendOnline
        connections={[{ name: "dev", display_name: "Development" }]}
        selectedConnection="dev"
        onSelectedConnectionChange={vi.fn()}
        connectedConnection={null}
        onConnect={onConnect}
        isConnecting={false}
        activityCount={0}
        activeActivitySessionId={null}
        workingSchema="HR"
        onWorkingSchemaChange={vi.fn()}
        onOpenSettings={onOpenSettings}
      />,
    );

    expect(screen.getByRole("banner", { name: "Product Header" })).toHaveTextContent("Apex Pilot");
    expect(screen.getByRole("region", { name: "Context Bar" })).toHaveTextContent("Demo");
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(onConnect).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(onOpenSettings).toHaveBeenCalled();
  });
});
