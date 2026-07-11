import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { App, resetConnectGuardsForTests } from "./App";
import { resetAutoConnectGuardsForTests } from "./IdeWorkspace";

const profileFixture = {
  profile_id: "profile-1",
  display_name: "Dev",
  email: null,
  username: null,
  created_at: "2026-07-09T00:00:00+00:00",
  updated_at: "2026-07-09T00:00:00+00:00",
};

const openedProjectFixture = {
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
  preflight: {
    ready: true,
    blocking_ids: [],
    checks: [],
  },
};

const workspaceFetch = (opened = openedProjectFixture) =>
  vi.fn((url: string, init?: RequestInit) => {
    if (url.includes("/preflight")) {
      return Promise.resolve(
        new Response(JSON.stringify({ ready: true, blocking_ids: [], checks: [] })),
      );
    }
    if (url.endsWith("/profiles")) {
      return Promise.resolve(new Response(JSON.stringify({ profiles: [profileFixture] })));
    }
    if (url.endsWith("/projects") || url.includes("/projects?")) {
      return Promise.resolve(new Response(JSON.stringify({ projects: [opened.project] })));
    }
    if (url.endsWith("/projects/current")) {
      return Promise.resolve(new Response(JSON.stringify(opened)));
    }
    if (url.endsWith("/health")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: "ok",
            service: "apex-pilot-backend",
            version: "0.1.0",
          }),
        ),
      );
    }
    if (
      url.endsWith("/connections") &&
      (!init || init.method === undefined || init.method === "GET")
    ) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            connections: [{ name: "dev", display_name: "Development" }],
          }),
        ),
      );
    }
    if (url.includes("/activity")) {
      return Promise.resolve(new Response(JSON.stringify({ entries: [], active_session_id: null })));
    }
    return Promise.resolve(new Response(JSON.stringify({})));
  });

const projectApiResponse = (url: string): Response | null => {
  if (url.includes("/preflight")) {
    return new Response(
      JSON.stringify({
        ready: true,
        blocking_ids: [],
        checks: [
          {
            id: "git",
            label: "Git",
            status: "ok",
            detail: "git version 2.45.0",
            guide: null,
          },
        ],
      }),
    );
  }
  if (url.endsWith("/profiles")) {
    return new Response(
      JSON.stringify({
        profiles: [
          {
            profile_id: "profile-1",
            display_name: "Dev",
            email: null,
            username: null,
            created_at: "2026-07-09T00:00:00+00:00",
            updated_at: "2026-07-09T00:00:00+00:00",
          },
        ],
      }),
    );
  }
  if (url.endsWith("/projects") || url.includes("/projects?")) {
    return new Response(JSON.stringify({ projects: [] }));
  }
  if (url.endsWith("/projects/current")) {
    return new Response("null", { status: 200 });
  }
  return null;
};

describe("App", () => {
  beforeEach(() => {
    localStorage.setItem("apex-pilot.first-launch-complete", "1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    resetConnectGuardsForTests();
    resetAutoConnectGuardsForTests();
  });

  it("renders the dense IDE chrome without backend configuration", async () => {
    render(<App />);

    expect(screen.getByRole("menubar", { name: /application menu/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Status bar")).toHaveTextContent(/backend not configured/i);
    expect(await screen.findByLabelText("Starting")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /mcp activity/i })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /new/i })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /settings/i })).toBeDisabled();
  });

  it("loads the recent-projects picker when the backend is online", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const projectResponse = projectApiResponse(url);
        if (projectResponse) {
          return Promise.resolve(projectResponse);
        }
        if (url.endsWith("/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                service: "apex-pilot-backend",
                version: "0.1.0",
              }),
            ),
          );
        }
        if (url.endsWith("/connections")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connections: [{ name: "dev", display_name: "Development" }],
              }),
            ),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ entries: [] })));
      }),
    );

    render(<App />);

    expect(await screen.findByLabelText("Status bar")).toHaveTextContent(/backend online/i);
    expect(await screen.findByRole("toolbar", { name: /project menu/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /mcp activity/i })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: /settings/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("menuitem", { name: /settings/i }));
    expect(await screen.findByLabelText("Settings")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "App preferences" })).toBeInTheDocument();
    expect(screen.getByText(/skip destructive sql sheet confirmation/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("toolbar", { name: /project menu/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^settings$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /mcp activity/i }));
    expect(
      await screen.findByText(/not connected to a database/i),
    ).toBeInTheDocument();
  });

  it("locks project menus during first-launch preflight and shows a continue CTA", async () => {
    localStorage.removeItem("apex-pilot.first-launch-complete");
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const projectResponse = projectApiResponse(url);
        if (projectResponse) {
          return Promise.resolve(projectResponse);
        }
        if (url.endsWith("/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                service: "apex-pilot-backend",
                version: "0.1.0",
              }),
            ),
          );
        }
        if (url.endsWith("/connections")) {
          return Promise.resolve(
            new Response(JSON.stringify({ connections: [{ name: "dev", display_name: "Development" }] })),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ entries: [] })));
      }),
    );

    render(<App />);

    expect(await screen.findByLabelText("Preflight")).toBeInTheDocument();
    expect(
      screen.getByText(/click/i).closest(".funnel-callout"),
    ).toHaveTextContent(/continue to profile setup/i);
    expect(screen.getByRole("button", { name: /continue to profile setup/i })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: /new/i })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /settings/i })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /mcp activity/i })).toBeDisabled();
  });

  it("keeps interim floating MCP when no project is open (console unavailable)", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        const projectResponse = projectApiResponse(url);
        if (projectResponse) {
          return Promise.resolve(projectResponse);
        }
        if (url.endsWith("/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                service: "apex-pilot-backend",
                version: "0.1.0",
              }),
            ),
          );
        }
        if (
          url.endsWith("/connections") &&
          (!init || init.method === undefined || init.method === "GET")
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connections: [{ name: "dev", display_name: "Development" }],
              }),
            ),
          );
        }
        if (url.endsWith("/connections/dev/connect") && init?.method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connection_name: "dev",
                role: "primary",
              }),
            ),
          );
        }
        if (url.includes("/activity")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                entries: [
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
                  {
                    sequence: 2,
                    timestamp: "2026-07-09T18:00:00.500+00:00",
                    tool_name: "connections_list",
                    arguments: { refresh: true },
                    status: "failed",
                    message: "timeout",
                    connection_name: "dev",
                    session_id: "session-1",
                  },
                  {
                    sequence: 3,
                    timestamp: "2026-07-09T18:00:01+00:00",
                    tool_name: "connect",
                    arguments: { connection_name: "dev" },
                    status: "succeeded",
                    message: null,
                    connection_name: "dev",
                    session_id: "session-2",
                  },
                ],
                active_session_id: "session-2",
              }),
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ entries: [], active_session_id: null })),
        );
      }),
    );

    render(<App />);

    expect(await screen.findByRole("toolbar", { name: /project menu/i })).toBeInTheDocument();

    // Open a project workspace path by simulating an opened project via New Project cancel path
    // is not enough for connect UI; connect lives in workspace. Open MCP from menu first.
    fireEvent.click(screen.getByRole("menuitem", { name: /mcp activity/i }));
    expect(await screen.findByLabelText("MCP Activity")).toBeInTheDocument();
  });

  it("exposes Mission Control chrome and region identities when a project is open", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    const opened = {
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
      preflight: {
        ready: true,
        blocking_ids: [],
        checks: [],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/preflight")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ready: true, blocking_ids: [], checks: [] })),
          );
        }
        if (url.endsWith("/profiles")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                profiles: [
                  {
                    profile_id: "profile-1",
                    display_name: "Dev",
                    email: null,
                    username: null,
                    created_at: "2026-07-09T00:00:00+00:00",
                    updated_at: "2026-07-09T00:00:00+00:00",
                  },
                ],
              }),
            ),
          );
        }
        if (url.endsWith("/projects") || url.includes("/projects?")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                projects: [opened.project],
              }),
            ),
          );
        }
        if (url.endsWith("/projects/current")) {
          return Promise.resolve(new Response(JSON.stringify(opened)));
        }
        if (url.endsWith("/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                service: "apex-pilot-backend",
                version: "0.1.0",
              }),
            ),
          );
        }
        if (url.endsWith("/connections")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connections: [{ name: "dev", display_name: "Development" }],
              }),
            ),
          );
        }
        if (url.includes("/activity")) {
          return Promise.resolve(
            new Response(JSON.stringify({ entries: [], active_session_id: null })),
          );
        }
        void init;
        return Promise.resolve(new Response(JSON.stringify({})));
      }),
    );

    render(<App />);

    expect(await screen.findByRole("region", { name: "Explorer" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Mission" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Inspector" })).toBeInTheDocument();
    // Spec startup layout: bottom Developer Console starts collapsed/hidden.
    expect(screen.queryByRole("region", { name: "Developer Console" })).not.toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Toolbar" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Context Bar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Connection")).toBeInTheDocument();
    expect(screen.getByLabelText("Working Schema")).toBeInTheDocument();
    expect(screen.getByLabelText("Environment")).toHaveTextContent(/dev/i);
    expect(screen.getByLabelText("Backend health")).toHaveTextContent(/online/i);
    expect(screen.getByLabelText("MCP health")).toBeInTheDocument();
    expect(screen.getByLabelText("Connection health")).toBeInTheDocument();
    expect(screen.getByLabelText("Status bar")).toBeInTheDocument();
    expect(screen.getByRole("menubar", { name: /application menu/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /developer console/i }));
    const consoleRegion = screen.getByRole("region", { name: "Developer Console" });
    expect(consoleRegion).toBeInTheDocument();
    const consoleTabs = within(consoleRegion).getByRole("tablist", {
      name: "Developer Console tabs",
    });
    expect(consoleTabs).toBeInTheDocument();
    expect(within(consoleTabs).getByRole("tab", { name: "Problems" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(consoleTabs).getByRole("tab", { name: "Output" })).toBeInTheDocument();
    expect(within(consoleTabs).getByRole("tab", { name: "MCP Activity" })).toBeInTheDocument();
    expect(within(consoleTabs).getByRole("tab", { name: "SQL History" })).toBeInTheDocument();
    expect(within(consoleTabs).getByRole("tab", { name: "Oracle Messages" })).toBeInTheDocument();
    expect(within(consoleTabs).getByRole("tab", { name: "Tasks" })).toBeInTheDocument();
    expect(within(consoleRegion).getByText("Stub")).toBeInTheDocument();
    expect(within(consoleRegion).getByText("Not implemented yet")).toBeInTheDocument();
    for (const tabTitle of ["Output", "SQL History", "Oracle Messages", "Tasks", "Problems"]) {
      fireEvent.click(within(consoleTabs).getByRole("tab", { name: tabTitle }));
      expect(within(consoleRegion).getByText("Stub")).toBeInTheDocument();
      expect(within(consoleRegion).getByText("Not implemented yet")).toBeInTheDocument();
    }
    fireEvent.click(within(consoleTabs).getByRole("tab", { name: "MCP Activity" }));
    const mcpPanel = within(consoleRegion).getByRole("tabpanel");
    expect(mcpPanel).not.toHaveTextContent("Stub");
    expect(mcpPanel).not.toHaveTextContent("Not implemented yet");
    expect(mcpPanel).toHaveTextContent(/no mcp tool activity yet|not connected to a database/i);
    expect(consoleRegion).not.toHaveTextContent(/\bGap\b/);
    expect(consoleRegion).not.toHaveTextContent(/\bDS-/);
    expect(consoleRegion).not.toHaveTextContent(/\bUI-\d+/);
    expect(consoleRegion).not.toHaveTextContent(/sample row|execution succeeded|mock timeline/i);

    const newSql = screen.getByRole("button", { name: "New SQL" });
    const run = screen.getByRole("button", { name: "Run" });
    expect(newSql).toBeDisabled();
    expect(run).toBeDisabled();
    expect(newSql).toHaveAttribute("title", "Not implemented yet");
    expect(run).toHaveAttribute("title", "Not implemented yet");

    // Product path: toolbar MCP Activity opens the Console tab, not the floating overlay.
    fireEvent.click(within(consoleTabs).getByRole("tab", { name: "Problems" }));
    expect(within(consoleTabs).getByRole("tab", { name: "Problems" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "MCP Activity" }));
    expect(within(consoleTabs).getByRole("tab", { name: "MCP Activity" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("dialog", { name: "MCP Activity" })).not.toBeInTheDocument();
    expect(within(consoleRegion).getByRole("tabpanel")).not.toHaveTextContent("Stub");

    // Mission center surface is present before Agent Core with explicit stub treatment.
    const mission = screen.getByRole("region", { name: "Mission" });
    expect(mission).toBeInTheDocument();
    expect(mission).toHaveTextContent("Mission");
    expect(mission).toHaveTextContent("Stub");
    expect(mission).toHaveTextContent("Not implemented yet");
    expect(mission).not.toHaveTextContent(/\bGap\b/);
    expect(mission).not.toHaveTextContent(/\bDS-/);
    expect(mission).not.toHaveTextContent(/\bUI-\d+/);
    expect(mission).not.toHaveTextContent(/sample row|execution succeeded|mock timeline|streaming/i);
    expect(screen.queryByLabelText("Chat")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Mission composer")).toBeInTheDocument();
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute("title", "Not implemented yet");
    expect(screen.getByLabelText("Project file tree")).toBeInTheDocument();
  });

  it("switches workspace density via settings and persists the profile preference", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    localStorage.setItem("apex-pilot.profile-layout.profile-1", JSON.stringify({ density: "compact" }));
    vi.stubGlobal("fetch", workspaceFetch());

    render(<App />);

    const contextBar = await screen.findByRole("region", { name: "Context Bar" });
    const shell = contextBar.closest(".ide-workspace");
    expect(shell).toHaveAttribute("data-density", "compact");

    fireEvent.click(screen.getByRole("menuitem", { name: /settings/i }));
    fireEvent.change(await screen.findByLabelText("Active profile"), {
      target: { value: "profile-1" },
    });
    const densitySelect = await screen.findByLabelText("Density");
    fireEvent.change(densitySelect, { target: { value: "comfortable" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    const contextBarAfterSave = await screen.findByRole("region", { name: "Context Bar" });
    const shellAfterSave = contextBarAfterSave.closest(".ide-workspace");
    expect(shellAfterSave).toHaveAttribute("data-density", "comfortable");
    expect(
      JSON.parse(localStorage.getItem("apex-pilot.profile-layout.profile-1") ?? "{}").density,
    ).toBe("comfortable");
  });

  it("flags reduced-motion mode on the workspace shell", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    vi.stubGlobal("fetch", workspaceFetch());

    render(<App />);

    const contextBar = await screen.findByRole("region", { name: "Context Bar" });
    expect(contextBar.closest(".ide-workspace")).toHaveAttribute("data-motion", "reduced");
  });

  it("toggles Explorer, Mission, Inspector, and Developer Console from View menu and shortcuts", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    const opened = {
      project: {
        project_id: "proj-panels",
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
      preflight: {
        ready: true,
        blocking_ids: [],
        checks: [],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/preflight")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ready: true, blocking_ids: [], checks: [] })),
          );
        }
        if (url.endsWith("/profiles")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                profiles: [
                  {
                    profile_id: "profile-1",
                    display_name: "Dev",
                    email: null,
                    username: null,
                    created_at: "2026-07-09T00:00:00+00:00",
                    updated_at: "2026-07-09T00:00:00+00:00",
                  },
                ],
              }),
            ),
          );
        }
        if (url.endsWith("/projects") || url.includes("/projects?")) {
          return Promise.resolve(
            new Response(JSON.stringify({ projects: [opened.project] })),
          );
        }
        if (url.endsWith("/projects/current")) {
          return Promise.resolve(new Response(JSON.stringify(opened)));
        }
        if (url.endsWith("/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                service: "apex-pilot-backend",
                version: "0.1.0",
              }),
            ),
          );
        }
        if (url.endsWith("/connections")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connections: [{ name: "dev", display_name: "Development" }],
              }),
            ),
          );
        }
        if (url.includes("/activity")) {
          return Promise.resolve(
            new Response(JSON.stringify({ entries: [], active_session_id: null })),
          );
        }
        void init;
        return Promise.resolve(new Response(JSON.stringify({})));
      }),
    );

    render(<App />);

    expect(await screen.findByRole("region", { name: "Explorer" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Mission" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Developer Console" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /^explorer$/i }));
    expect(screen.queryByRole("region", { name: "Explorer" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /^explorer$/i }));
    expect(screen.getByRole("region", { name: "Explorer" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /^inspector$/i }));
    expect(screen.queryByRole("region", { name: "Inspector" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /^mission$/i }));
    expect(screen.queryByRole("region", { name: "Mission" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /developer console/i }));
    expect(screen.getByRole("region", { name: "Developer Console" })).toBeInTheDocument();

    // Menu bar / toolbar / status remain — chrome identity survives panel collapse.
    expect(screen.getByRole("menubar", { name: /application menu/i })).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Toolbar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Status bar")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(screen.queryByRole("region", { name: "Explorer" })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(screen.getByRole("region", { name: "Explorer" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "I", ctrlKey: true, shiftKey: true });
    expect(screen.getByRole("region", { name: "Inspector" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "M", ctrlKey: true, shiftKey: true });
    expect(screen.getByRole("region", { name: "Mission" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "`", ctrlKey: true });
    expect(screen.queryByRole("region", { name: "Developer Console" })).not.toBeInTheDocument();
  });

  it("opens the command palette with Ctrl+Shift+P and runs a shell action", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    const opened = {
      project: {
        project_id: "proj-palette",
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
      preflight: {
        ready: true,
        blocking_ids: [],
        checks: [],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/preflight")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ready: true, blocking_ids: [], checks: [] })),
          );
        }
        if (url.endsWith("/profiles")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                profiles: [
                  {
                    profile_id: "profile-1",
                    display_name: "Dev",
                    email: null,
                    username: null,
                    created_at: "2026-07-09T00:00:00+00:00",
                    updated_at: "2026-07-09T00:00:00+00:00",
                  },
                ],
              }),
            ),
          );
        }
        if (url.endsWith("/projects") || url.includes("/projects?")) {
          return Promise.resolve(
            new Response(JSON.stringify({ projects: [opened.project] })),
          );
        }
        if (url.endsWith("/projects/current")) {
          return Promise.resolve(new Response(JSON.stringify(opened)));
        }
        if (url.endsWith("/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                service: "apex-pilot-backend",
                version: "0.1.0",
              }),
            ),
          );
        }
        if (url.endsWith("/connections")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connections: [{ name: "dev", display_name: "Development" }],
              }),
            ),
          );
        }
        if (url.includes("/activity")) {
          return Promise.resolve(
            new Response(JSON.stringify({ entries: [], active_session_id: null })),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({})));
      }),
    );

    render(<App />);

    expect(await screen.findByRole("region", { name: "Explorer" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /command palette/i })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "P", ctrlKey: true, shiftKey: true });
    const palette = await screen.findByRole("dialog", { name: /command palette/i });
    expect(palette).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /toggle explorer/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /toggle developer console/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /project: settings/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /toggle explorer/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /command palette/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("region", { name: "Explorer" })).not.toBeInTheDocument();
  });

  it("ignores a second connect while one is already in flight", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    let resolveConnect: ((value: Response) => void) | undefined;
    const connectPromise = new Promise<Response>((resolve) => {
      resolveConnect = resolve;
    });
    const opened = {
      project: {
        project_id: "proj-guard",
        profile_id: "profile-1",
        name: "Demo",
        root_path: "C:/tmp/demo",
        retention_days: 365,
        created_at: "2026-07-09T00:00:00+00:00",
        updated_at: "2026-07-09T00:00:00+00:00",
      },
      manifest: {},
      environment_mappings: [],
      apex_workspace_mappings: [],
      unmapped_environments: [],
      preflight: { ready: true, blocking_ids: [], checks: [] },
    };
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/preflight")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ready: true, blocking_ids: [], checks: [] })),
        );
      }
      if (url.endsWith("/profiles")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              profiles: [
                {
                  profile_id: "profile-1",
                  display_name: "Dev",
                  email: null,
                  username: null,
                  created_at: "2026-07-09T00:00:00+00:00",
                  updated_at: "2026-07-09T00:00:00+00:00",
                },
              ],
            }),
          ),
        );
      }
      if (url.endsWith("/projects") || url.includes("/projects?")) {
        return Promise.resolve(new Response(JSON.stringify({ projects: [opened.project] })));
      }
      if (url.endsWith("/projects/current")) {
        return Promise.resolve(new Response(JSON.stringify(opened)));
      }
      if (url.endsWith("/health")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: "ok",
              service: "apex-pilot-backend",
              version: "0.1.0",
            }),
          ),
        );
      }
      if (
        url.endsWith("/connections") &&
        (!init || init.method === undefined || init.method === "GET")
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              connections: [{ name: "dev", display_name: "Development" }],
            }),
          ),
        );
      }
      if (url.endsWith("/connections/dev/connect") && init?.method === "POST") {
        return connectPromise;
      }
      return Promise.resolve(new Response(JSON.stringify({ entries: [], active_session_id: null })));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByLabelText("Connection")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    fireEvent.click(screen.getByRole("button", { name: /connecting/i }));

    const connectCalls = fetchMock.mock.calls.filter(
      ([url, init]) =>
        typeof url === "string" &&
        url.endsWith("/connections/dev/connect") &&
        init?.method === "POST",
    );
    expect(connectCalls).toHaveLength(1);

    resolveConnect?.(
      new Response(JSON.stringify({ connection_name: "dev", role: "primary" })),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /connected · reconnect/i })).toBeEnabled();
    });
  });

  it("connects from the workspace connection strip", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    let resolveConnect: ((value: Response) => void) | undefined;
    const connectPromise = new Promise<Response>((resolve) => {
      resolveConnect = resolve;
    });
    const opened = {
      project: {
        project_id: "proj-1",
        profile_id: "profile-1",
        name: "Demo",
        root_path: "C:/tmp/demo",
        retention_days: 365,
        created_at: "2026-07-09T00:00:00+00:00",
        updated_at: "2026-07-09T00:00:00+00:00",
      },
      manifest: {},
      environment_mappings: [],
      apex_workspace_mappings: [],
      unmapped_environments: [],
      preflight: { ready: true, blocking_ids: [], checks: [] },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/preflight")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ready: true, blocking_ids: [], checks: [] })),
          );
        }
        if (url.endsWith("/profiles")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                profiles: [
                  {
                    profile_id: "profile-1",
                    display_name: "Dev",
                    email: null,
                    username: null,
                    created_at: "2026-07-09T00:00:00+00:00",
                    updated_at: "2026-07-09T00:00:00+00:00",
                  },
                ],
              }),
            ),
          );
        }
        if (url.endsWith("/projects") || url.includes("/projects?")) {
          return Promise.resolve(new Response(JSON.stringify({ projects: [opened.project] })));
        }
        if (url.endsWith("/projects/current")) {
          return Promise.resolve(new Response(JSON.stringify(opened)));
        }
        if (url.endsWith("/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                service: "apex-pilot-backend",
                version: "0.1.0",
              }),
            ),
          );
        }
        if (
          url.endsWith("/connections") &&
          (!init || init.method === undefined || init.method === "GET")
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connections: [{ name: "dev", display_name: "Development" }],
              }),
            ),
          );
        }
        if (url.endsWith("/connections/dev/connect") && init?.method === "POST") {
          return connectPromise;
        }
        return Promise.resolve(new Response(JSON.stringify({ entries: [], active_session_id: null })));
      }),
    );

    render(<App />);

    expect(await screen.findByLabelText("Connection")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByRole("button", { name: /connecting/i })).toBeDisabled();

    resolveConnect?.(
      new Response(JSON.stringify({ connection_name: "dev", role: "primary" })),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /connected · reconnect/i })).toBeEnabled();
    });
    expect(screen.getByLabelText("Status bar")).toHaveTextContent(/db: dev/i);
  });

  it("shows schema running state in the schema tool", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    let resolveSummary: ((value: Response) => void) | undefined;
    const summaryPromise = new Promise<Response>((resolve) => {
      resolveSummary = resolve;
    });
    const opened = {
      project: {
        project_id: "proj-1",
        profile_id: "profile-1",
        name: "Demo",
        root_path: "C:/tmp/demo",
        retention_days: 365,
        created_at: "2026-07-09T00:00:00+00:00",
        updated_at: "2026-07-09T00:00:00+00:00",
      },
      manifest: {},
      environment_mappings: [],
      apex_workspace_mappings: [],
      unmapped_environments: [],
      preflight: { ready: true, blocking_ids: [], checks: [] },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/preflight")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ready: true, blocking_ids: [], checks: [] })),
          );
        }
        if (url.endsWith("/profiles")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                profiles: [
                  {
                    profile_id: "profile-1",
                    display_name: "Dev",
                    email: null,
                    username: null,
                    created_at: "2026-07-09T00:00:00+00:00",
                    updated_at: "2026-07-09T00:00:00+00:00",
                  },
                ],
              }),
            ),
          );
        }
        if (url.endsWith("/projects") || url.includes("/projects?")) {
          return Promise.resolve(new Response(JSON.stringify({ projects: [opened.project] })));
        }
        if (url.endsWith("/projects/current")) {
          return Promise.resolve(new Response(JSON.stringify(opened)));
        }
        if (url.endsWith("/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                service: "apex-pilot-backend",
                version: "0.1.0",
              }),
            ),
          );
        }
        if (
          url.endsWith("/connections") &&
          (!init || init.method === undefined || init.method === "GET")
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connections: [{ name: "dev", display_name: "Development" }],
              }),
            ),
          );
        }
        if (url.endsWith("/connections/dev/connect") && init?.method === "POST") {
          return Promise.resolve(
            new Response(JSON.stringify({ connection_name: "dev", role: "primary" })),
          );
        }
        if (url.endsWith("/session/context")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                connection_name: "dev",
                database_context: {
                  current_user: "APP",
                  current_schema: "APP",
                  proxy_user: null,
                  db_name: "ORCL",
                  container_name: null,
                  cdb_name: null,
                  host: null,
                },
                suggested_schema: "APP",
              }),
            ),
          );
        }
        if (url.endsWith("/session/schema") && init?.method === "POST") {
          return Promise.resolve(
            new Response(JSON.stringify({ schema_name: "APP", connection_name: "dev" })),
          );
        }
        if (url.includes("/schema/summary?")) {
          return summaryPromise;
        }
        return Promise.resolve(new Response(JSON.stringify({ entries: [], active_session_id: null })));
      }),
    );

    render(<App />);

    expect(await screen.findByLabelText("Connection")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /connected · reconnect/i })).toBeInTheDocument();
    });

    // After connect, schema auto-selects from session context and loads summary.
    expect(await screen.findByRole("button", { name: /loading/i })).toBeDisabled();
    expect(screen.getByLabelText("Schema")).toHaveValue("APP");
    expect(screen.getByText(/db connected: dev/i)).toBeInTheDocument();

    resolveSummary?.(
      new Response(
        JSON.stringify({
          schema_name: "APP",
          connection_name: "dev",
          database_context: {
            current_user: "APP",
            current_schema: "APP",
            proxy_user: null,
            db_name: "ORCL",
            container_name: null,
            cdb_name: null,
            host: null,
          },
          object_counts: [],
          tables: [],
          cache_age_seconds: 0.1,
          captured_at: "2026-07-09T18:00:00+00:00",
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Load" })).toBeEnabled();
    });
    expect(await screen.findByText(/browsing login schema app/i)).toBeInTheDocument();
    expect(screen.getByText(/db connected: dev/i)).toBeInTheDocument();
    expect(screen.getByText(/browsing: app/i)).toBeInTheDocument();
  });
});
