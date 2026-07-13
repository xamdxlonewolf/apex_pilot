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

    expect(await screen.findByLabelText("Status bar")).toHaveTextContent(/backend:\s*healthy/i);
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
    expect(screen.getByRole("banner", { name: "Product Header" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Context Bar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Connection")).toBeInTheDocument();
    expect(screen.getByLabelText("Working Schema")).toBeInTheDocument();
    expect(screen.getByLabelText("Environment")).toHaveTextContent(/dev/i);
    expect(screen.getByLabelText("Backend health")).toHaveTextContent(/healthy/i);
    expect(screen.getByLabelText("MCP health")).toBeInTheDocument();
    expect(screen.getByLabelText("Connection health")).toBeInTheDocument();
    expect(screen.getByLabelText("Status bar")).toBeInTheDocument();
    expect(screen.getByRole("menubar", { name: /application menu/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "File" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Help" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Project" })).not.toBeInTheDocument();

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

    const toolbar = screen.getByRole("toolbar", { name: "Toolbar" });
    const newSql = within(toolbar).getByRole("button", { name: "New SQL" });
    const run = within(toolbar).getByRole("button", { name: "Run" });
    // Progressive enablement: New SQL is live; Run waits on real preconditions (not Stub).
    expect(newSql).toBeEnabled();
    expect(newSql).toHaveAttribute("title", "Open the SQL Editor");
    expect(run).toBeDisabled();
    expect(run).toHaveAttribute("title", "Connect a SQLcl saved connection to run SQL.");
    expect(run).not.toHaveAttribute("title", "Not implemented yet");

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

    // Mission peer is present before Agent Core with explicit stub treatment.
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

    // Activity Rail + dual-primary Workspace (Shell IA).
    expect(screen.getByRole("region", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Editors" })).toBeInTheDocument();
    const activityRail = screen.getByRole("navigation", { name: "Activity Rail" });
    for (const name of ["Files", "Agent", "Code", "Database", "APEX", "Review"]) {
      expect(within(activityRail).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(within(activityRail).getByRole("button", { name: "Agent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Agent" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // Files posture hosts the project tree; Database hosts schema browse.
    fireEvent.click(within(activityRail).getByRole("button", { name: "Files" }));
    expect(screen.getByLabelText("Project file tree")).toBeInTheDocument();
    const explorer = screen.getByRole("region", { name: "Explorer" });
    const inspector = screen.getByRole("region", { name: "Inspector" });
    expect(within(inspector).queryByRole("tablist", { name: "Inspector tabs" })).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("tab", { name: /^schema$/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Schema browser")).not.toBeInTheDocument();
    fireEvent.click(within(activityRail).getByRole("button", { name: "Database" }));
    expect(within(explorer).getByLabelText("Schema browser")).toBeInTheDocument();
    fireEvent.click(within(activityRail).getByRole("button", { name: "APEX" }));
    expect(within(explorer).getByLabelText("APEX browser")).toBeInTheDocument();
    const stubSurface = within(explorer).getByTestId("stub-surface");
    expect(within(stubSurface).getByText("Stub")).toBeInTheDocument();
    expect(within(stubSurface).getByText("Not implemented yet")).toBeInTheDocument();
    expect(within(stubSurface).queryByText(/sample row|EMPLOYEE|mock timeline/i)).not.toBeInTheDocument();
  });

  it("hosts SQL Editor in dual-primary Workspace editors only and never in the Inspector", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal("fetch", workspaceFetch());

    render(<App />);

    const mission = await screen.findByRole("region", { name: "Mission" });
    const editors = screen.getByRole("region", { name: "Editors" });
    const inspector = screen.getByRole("region", { name: "Inspector" });

    const editorTabs = within(editors).getByRole("tablist", {
      name: "Editor workspace tabs",
    });
    expect(within(editorTabs).queryByRole("tab", { name: "Mission" })).not.toBeInTheDocument();
    expect(within(editorTabs).getByRole("tab", { name: "SQL Editor" })).toBeInTheDocument();
    expect(within(mission).getByLabelText("Mission composer")).toBeInTheDocument();

    expect(within(inspector).queryByRole("tablist", { name: "Inspector tabs" })).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("tab", { name: /SQL/i })).not.toBeInTheDocument();
    expect(within(inspector).queryByLabelText("SQL sheet")).not.toBeInTheDocument();
    expect(within(inspector).queryByLabelText(/^SQL$/)).not.toBeInTheDocument();

    fireEvent.click(within(editorTabs).getByRole("tab", { name: "SQL Editor" }));
    expect(within(editors).getByLabelText("SQL sheet")).toBeInTheDocument();
    expect(within(editors).getByLabelText("SQL")).toBeInTheDocument();
    expect(within(inspector).queryByLabelText("SQL sheet")).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("textbox", { name: /^SQL$/ })).not.toBeInTheDocument();
    // Sticky Agent: Mission peer remains present while editing SQL.
    expect(within(mission).getByLabelText("Mission composer")).toBeInTheDocument();
  });

  it("progressively enables New SQL and Run without Stub or fake success", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    localStorage.setItem(
      "apex-pilot.project-tabs.proj-1",
      JSON.stringify({
        openTabs: [
          { id: "sql", kind: "sql", title: "SQL Editor" },
          { id: "stub:file", kind: "file", title: "File Editor" },
        ],
        activeTabId: "stub:file",
        activeCenterTabId: "stub:file",
        activeInspectorTabId: null,
      }),
    );
    const baseFetch = workspaceFetch();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/connections/dev/connect") && init?.method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ connected: true, connection_name: "dev" })),
        );
      }
      if (url.endsWith("/sql/run") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              classification: {
                decision: "allow",
                access: "read_only",
                category: "query",
                operation: "select",
                reasons: ["read-only select"],
              },
              connection_name: "dev",
              schema_name: "HR",
              rows: [{ DUMMY: "X" }],
              raw_text: null,
              executed: true,
            }),
          ),
        );
      }
      return baseFetch(url, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const toolbar = await screen.findByRole("toolbar", { name: "Toolbar" });
    const newSql = within(toolbar).getByRole("button", { name: "New SQL" });
    const run = within(toolbar).getByRole("button", { name: "Run" });

    expect(newSql).toBeEnabled();
    expect(run).toBeDisabled();
    expect(run).toHaveAttribute("title", "Focus the SQL Editor to run.");
    expect(run).not.toHaveAttribute("title", "Not implemented yet");

    fireEvent.click(newSql);
    expect(screen.getByRole("menuitemradio", { name: "SQL" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const editors = screen.getByRole("region", { name: "Editors" });
    expect(within(editors).getByLabelText("SQL sheet")).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Run" })).toBeDisabled();
    expect(within(toolbar).getByRole("button", { name: "Run" })).toHaveAttribute(
      "title",
      "Connect a SQLcl saved connection to run SQL.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /connected · reconnect/i })).toBeEnabled();
    });

    const toolbarRun = within(toolbar).getByRole("button", { name: "Run" });
    await waitFor(() => {
      expect(toolbarRun).toBeEnabled();
    });
    expect(toolbarRun).toHaveAttribute("title", "Run the SQL Editor buffer.");

    fireEvent.click(toolbarRun);
    expect(await screen.findByText(/allow · select · 1 rows/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/sql\/run$/),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("hosts stubbed object / package / APEX / REST / diff / file editors in center workspace tabs", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    localStorage.setItem(
      "apex-pilot.project-tabs.proj-1",
      JSON.stringify({
        openTabs: [
          { id: "mission", kind: "mission", title: "Mission" },
          { id: "sql", kind: "sql", title: "SQL Editor" },
          { id: "stub:object", kind: "object", title: "Object Editor" },
          { id: "stub:package", kind: "package", title: "Package Editor" },
          { id: "stub:apex", kind: "apex", title: "APEX Editor" },
          { id: "stub:rest", kind: "rest", title: "REST Editor" },
          { id: "stub:diff", kind: "diff", title: "Diff Editor" },
          { id: "stub:file", kind: "file", title: "File Editor" },
          { id: "mappings", kind: "mappings", title: "Mappings" },
        ],
        activeTabId: "stub:object",
        activeCenterTabId: "stub:object",
        activeInspectorTabId: "mappings",
      }),
    );
    vi.stubGlobal("fetch", workspaceFetch());

    render(<App />);

    const editors = await screen.findByRole("region", { name: "Editors" });
    const editorTabs = within(editors).getByRole("tablist", {
      name: "Editor workspace tabs",
    });
    const stubTitles = [
      "Object Editor",
      "Package Editor",
      "APEX Editor",
      "REST Editor",
      "Diff Editor",
      "File Editor",
    ];
    for (const title of stubTitles) {
      expect(within(editorTabs).getByRole("tab", { name: title })).toBeInTheDocument();
    }

    for (const title of stubTitles) {
      fireEvent.click(within(editorTabs).getByRole("tab", { name: title }));
      const stubSurface = within(editors).getByTestId("stub-surface");
      expect(within(stubSurface).getByText("Stub")).toBeInTheDocument();
      expect(within(stubSurface).getByText("Not implemented yet")).toBeInTheDocument();
      expect(within(stubSurface).getByText(title)).toBeInTheDocument();
      expect(within(stubSurface).queryByText(/\bGap\b/)).not.toBeInTheDocument();
      expect(within(stubSurface).queryByText(/\bDS-/)).not.toBeInTheDocument();
      expect(within(stubSurface).queryByText(/\bUI-\d+/)).not.toBeInTheDocument();
      expect(
        within(stubSurface).queryByText(/sample row|execution succeeded|mock timeline|EMPLOYEE/i),
      ).not.toBeInTheDocument();
    }

    const inspector = screen.getByRole("region", { name: "Inspector" });
    expect(within(inspector).queryByRole("tab", { name: /Object Editor|Package Editor/i })).not.toBeInTheDocument();
  });

  it("makes the right pane a pure stage-driven Inspector with honest stage chrome and no tool tabs", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal("fetch", workspaceFetch());

    render(<App />);

    const inspector = await screen.findByRole("region", { name: "Inspector" });
    expect(within(inspector).getByLabelText("Inspector panel")).toBeInTheDocument();
    const stages = within(inspector).getByLabelText("Inspector stages");
    for (const name of ["Plan", "SQL Generated", "Review", "Execute", "Complete"]) {
      expect(within(stages).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(within(inspector).getByRole("region", { name: "Plan stage" })).toBeInTheDocument();

    expect(within(inspector).queryByRole("tablist", { name: "Inspector tabs" })).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("tab", { name: /^schema$/i })).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("tab", { name: /SQL/i })).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("tab", { name: /^mappings$/i })).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("region", { name: "Mappings preferences" })).not.toBeInTheDocument();
    expect(within(inspector).queryByLabelText("Project mappings")).not.toBeInTheDocument();
    expect(within(inspector).queryByText("Mappings")).not.toBeInTheDocument();
    expect(within(inspector).queryByLabelText("SQL sheet")).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("textbox", { name: /^SQL$/ })).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("button", { name: /^Run$/i })).not.toBeInTheDocument();
    // Stage nav includes Execute; Plan evidence has no live Execute action.
    expect(
      within(within(inspector).getByRole("region", { name: "Plan stage" })).queryByRole("button", {
        name: /^Execute$/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("hosts Environment mappings in Settings preferences UX, not the Inspector", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal(
      "fetch",
      workspaceFetch({
        ...openedProjectFixture,
        environment_mappings: [],
        unmapped_environments: ["dev"],
      }),
    );

    render(<App />);

    const productHeader = await screen.findByRole("banner", { name: "Product Header" });
    expect(productHeader).toBeInTheDocument();
    const contextBar = within(productHeader).getByRole("region", { name: "Context Bar" });
    expect(within(productHeader).getByRole("button", { name: "Open Settings" })).toBeInTheDocument();
    expect(within(contextBar).queryByRole("button", { name: /^Mappings$/i })).not.toBeInTheDocument();

    const inspector = screen.getByRole("region", { name: "Inspector" });
    expect(within(inspector).queryByLabelText("Project mappings")).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("region", { name: "Mappings preferences" })).not.toBeInTheDocument();

    fireEvent.click(within(productHeader).getByRole("button", { name: "Open Settings" }));

    const settings = await screen.findByLabelText("Settings");
    expect(within(settings).getByRole("heading", { name: /Environment mappings/i })).toBeInTheDocument();
    expect(within(settings).getByLabelText("Project mappings")).toBeInTheDocument();
    const mappingList = within(settings).getByRole("list", { name: "Environment mappings" });
    expect(within(mappingList).getByText("dev")).toBeInTheDocument();
    expect(within(mappingList).getByRole("button", { name: /Save mapping/i })).toBeInTheDocument();

    fireEvent.click(within(settings).getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^Settings$/i }));
    const settingsFromMenu = await screen.findByLabelText("Settings");
    expect(within(settingsFromMenu).getByLabelText("Project mappings")).toBeInTheDocument();
  });

  it("persists profile layout panel visibility across workspace remounts", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    localStorage.setItem(
      "apex-pilot.profile-layout.profile-1",
      JSON.stringify({
        showExplorer: false,
        showInspector: false,
        showConsole: true,
        leftWidth: 340,
        rightWidth: 420,
      }),
    );
    vi.stubGlobal("fetch", workspaceFetch());

    const { unmount } = render(<App />);

    expect(await screen.findByRole("region", { name: "Mission" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Explorer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Inspector" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Developer Console" })).toBeInTheDocument();

    unmount();
    render(<App />);

    expect(await screen.findByRole("region", { name: "Mission" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Explorer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Inspector" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Developer Console" })).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem("apex-pilot.profile-layout.profile-1") ?? "{}").showExplorer,
    ).toBe(false);
  });

  it("restores project-scoped center tabs for Mission Control arrangement", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    localStorage.setItem(
      "apex-pilot.project-tabs.proj-1",
      JSON.stringify({
        openTabs: [
          { id: "mission", kind: "mission", title: "Mission" },
          { id: "sql", kind: "sql", title: "SQL Editor" },
          { id: "stub:package", kind: "package", title: "Package Editor" },
          { id: "mappings", kind: "mappings", title: "Mappings" },
        ],
        activeTabId: "stub:package",
        activeCenterTabId: "stub:package",
      }),
    );
    vi.stubGlobal("fetch", workspaceFetch());

    render(<App />);

    const editors = await screen.findByRole("region", { name: "Editors" });
    const editorTabs = within(editors).getByRole("tablist", {
      name: "Editor workspace tabs",
    });
    expect(within(editorTabs).getByRole("tab", { name: "Package Editor" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(editorTabs).queryByRole("tab", { name: /^Mappings$/i })).not.toBeInTheDocument();
    expect(within(editors).getByTestId("stub-surface")).toHaveTextContent("Package Editor");
  });

  it("prompts on Close Project when editors are dirty and returns to the recent-projects picker", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal("fetch", workspaceFetch());
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App />);

    const editors = await screen.findByRole("region", { name: "Editors" });
    const editorTabs = within(editors).getByRole("tablist", {
      name: "Editor workspace tabs",
    });
    fireEvent.click(within(editorTabs).getByRole("tab", { name: "SQL Editor" }));
    fireEvent.change(within(editors).getByLabelText("SQL"), {
      target: { value: "select 1 from dual" },
    });

    fireEvent.click(screen.getByRole("menuitem", { name: /^Close Project$/i }));

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith(
        expect.stringMatching(/unsaved work/i),
      );
    });
    expect(await screen.findByRole("toolbar", { name: /project menu/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Mission" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Recent projects" })).toBeInTheDocument();
  });

  it("keeps one project open when dirty Close Project is cancelled", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal("fetch", workspaceFetch());
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<App />);

    const editors = await screen.findByRole("region", { name: "Editors" });
    const editorTabs = within(editors).getByRole("tablist", {
      name: "Editor workspace tabs",
    });
    fireEvent.click(within(editorTabs).getByRole("tab", { name: "SQL Editor" }));
    fireEvent.change(within(editors).getByLabelText("SQL"), {
      target: { value: "select * from emp" },
    });

    fireEvent.click(screen.getByRole("menuitem", { name: /^Close Project$/i }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
    expect(screen.getByRole("region", { name: "Mission" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Recent projects")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Context Bar" })).toHaveTextContent("Demo");
  });

  it("closes a clean project to the recent-projects picker without an unsaved prompt", async () => {
    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    vi.stubGlobal("fetch", workspaceFetch());
    const confirm = vi.spyOn(window, "confirm");

    render(<App />);

    await screen.findByRole("region", { name: "Mission" });
    fireEvent.click(screen.getByRole("menuitem", { name: /^Close Project$/i }));

    expect(await screen.findByRole("toolbar", { name: /project menu/i })).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Mission" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Recent projects" })).toBeInTheDocument();
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
    expect(screen.getByRole("option", { name: /file: settings/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /toggle explorer/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /command palette/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("region", { name: "Explorer" })).not.toBeInTheDocument();
  });

  it("opens Quick Open with Ctrl+P without breaking Ctrl+Shift+P command palette", async () => {
    const { installBrowserProjectFs, browserFsFromTree, resetBrowserProjectFsForTests } =
      await import("./projectFs");
    installBrowserProjectFs(
      browserFsFromTree(
        {
          "C:/tmp/demo": [{ name: "README.md", kind: "file" }],
        },
        { "C:/tmp/demo/README.md": "# demo" },
      ),
    );

    vi.stubGlobal("__APEX_PILOT__", {
      baseUrl: "http://127.0.0.1:8000",
      bearerToken: "test-token",
    });
    const opened = {
      project: {
        project_id: "proj-quick-open",
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

    try {
      render(<App />);
      expect(await screen.findByRole("region", { name: "Explorer" })).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "p", ctrlKey: true, code: "KeyP" });
      expect(await screen.findByRole("dialog", { name: /quick open/i })).toBeInTheDocument();
      expect(await screen.findByRole("option", { name: /README\.md/i })).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: /quick open/i })).not.toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: "P", ctrlKey: true, shiftKey: true, code: "KeyP" });
      expect(await screen.findByRole("dialog", { name: /command palette/i })).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: /quick open/i })).not.toBeInTheDocument();
    } finally {
      resetBrowserProjectFsForTests();
    }
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

    // M3: Working Schema autofills from session context without opening Database Explorer.
    await waitFor(() => {
      expect(screen.getByLabelText("Working Schema")).toHaveValue("APP");
    });
    expect(screen.getByText(/unqualified objects target APP/i)).toBeInTheDocument();

    // Schema browsing lives under Explorer Database — not a permanent Inspector tab.
    const explorer = screen.getByRole("region", { name: "Explorer" });
    fireEvent.click(within(explorer).getByRole("button", { name: "Database" }));
    expect(within(explorer).getByLabelText("Schema browser")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Inspector" })).queryByRole("tab", {
        name: /^schema$/i,
      }),
    ).not.toBeInTheDocument();
    expect(within(explorer).queryByText(/connect, then load/i)).not.toBeInTheDocument();
    expect(within(explorer).queryByText(/use connect in the strip/i)).not.toBeInTheDocument();

    // After connect + opening Database, schema auto-selects from session context and loads summary.
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
          tables: [{ table_name: "EMPLOYEES", num_rows: 10, last_analyzed: null, partitioned: null, iot_type: null }],
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

    fireEvent.click(within(explorer).getByRole("button", { name: /EMPLOYEES/i }));
    const editors = screen.getByRole("region", { name: "Editors" });
    expect(within(editors).getByRole("tab", { name: /EMPLOYEES/i })).toBeInTheDocument();
    expect(within(editors).getByLabelText("object viewer")).toBeInTheDocument();
    expect(within(editors).getByText(/TABLE APP\.EMPLOYEES/i)).toBeInTheDocument();
  });
});
