import {
  defaultProfileLayout,
  loadProfileLayout,
  loadProjectTabs,
  resolveActivityRailShowLabels,
  saveProfileLayout,
  saveProjectTabs,
} from "./prefs";

describe("prefs persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists profile-scoped layout prefs across load/save sessions", () => {
    const profileId = "profile-1";
    const prefs = {
      ...defaultProfileLayout(),
      density: "comfortable" as const,
      activityRailLabels: "icons-labels" as const,
      leftWidth: 320,
      rightWidth: 400,
      databaseWidth: 340,
      missionWidth: 520,
      consoleHeight: 220,
      explorerDrawerSide: "right" as const,
      inspectorDrawerSide: "left" as const,
      databaseDrawerSide: "left" as const,
      showConsole: true,
      showJunkFiles: true,
      skipDestructiveSqlPrompt: true,
      autoReconnectInteractive: true,
    };

    saveProfileLayout(profileId, prefs);
    const restored = loadProfileLayout(profileId);

    expect(restored.density).toBe("comfortable");
    expect(restored.activityRailLabels).toBe("icons-labels");
    expect(restored.leftWidth).toBe(320);
    expect(restored.rightWidth).toBe(400);
    expect(restored.databaseWidth).toBe(340);
    expect(restored.missionWidth).toBe(520);
    expect(restored.consoleHeight).toBe(220);
    expect(restored.explorerDrawerSide).toBe("right");
    expect(restored.inspectorDrawerSide).toBe("left");
    expect(restored.databaseDrawerSide).toBe("left");
    expect(restored.showConsole).toBe(true);
    expect(restored.showJunkFiles).toBe(true);
    expect(restored.skipDestructiveSqlPrompt).toBe(true);
    expect(restored.autoReconnectInteractive).toBe(true);
  });

  it("defaults activityRailLabels to auto and sanitizes unknown values", () => {
    expect(defaultProfileLayout().activityRailLabels).toBe("auto");
    saveProfileLayout("profile-1", {
      ...defaultProfileLayout(),
      activityRailLabels: "icons",
    });
    localStorage.setItem(
      "apex-pilot.profile-layout.profile-bad",
      JSON.stringify({
        ...defaultProfileLayout(),
        activityRailLabels: "stacked",
      }),
    );

    expect(loadProfileLayout("profile-1").activityRailLabels).toBe("icons");
    expect(loadProfileLayout("profile-bad").activityRailLabels).toBe("auto");
  });

  it("resolves Activity Rail label visibility from preference + breakpoint", () => {
    expect(resolveActivityRailShowLabels("auto", true)).toBe(true);
    expect(resolveActivityRailShowLabels("auto", false)).toBe(false);
    expect(resolveActivityRailShowLabels("icons", true)).toBe(false);
    expect(resolveActivityRailShowLabels("icons-labels", false)).toBe(true);
  });

  it("scopes layout prefs per profile id and ignores legacy show* panel flags", () => {
    saveProfileLayout("profile-a", {
      ...defaultProfileLayout(),
      density: "compact",
      databaseDrawerSide: "left",
    });
    localStorage.setItem(
      "apex-pilot.profile-layout.profile-legacy",
      JSON.stringify({
        ...defaultProfileLayout(),
        showExplorer: false,
        showMission: true,
        showInspector: false,
        density: "comfortable",
      }),
    );
    saveProfileLayout("profile-b", {
      ...defaultProfileLayout(),
      density: "comfortable",
      showConsole: true,
    });

    expect(loadProfileLayout("profile-a").density).toBe("compact");
    expect(loadProfileLayout("profile-a").databaseDrawerSide).toBe("left");
    expect(loadProfileLayout("profile-legacy").density).toBe("comfortable");
    expect(loadProfileLayout("profile-legacy").showConsole).toBe(false);
    expect(loadProfileLayout("profile-b").density).toBe("comfortable");
    expect(loadProfileLayout("profile-b").showConsole).toBe(true);
    expect(loadProfileLayout(null)).toEqual(defaultProfileLayout());
  });

  it("restores project-scoped open tabs and active center tab across sessions", () => {
    const projectId = "proj-1";
    saveProjectTabs(projectId, {
      openTabs: [
        { id: "mission", kind: "mission", title: "Mission" },
        { id: "sql", kind: "sql", title: "SQL Editor" },
        { id: "stub:object", kind: "object", title: "Object Editor" },
        { id: "file:/tmp/a.sql", kind: "file", title: "a.sql", path: "/tmp/a.sql" },
      ],
      activeTabId: "stub:object",
      activeCenterTabId: "stub:object",
      activeInspectorTabId: null,
    });

    const restored = loadProjectTabs(projectId);
    expect(restored.openTabs.map((tab) => tab.id)).toEqual([
      "mission",
      "sql",
      "stub:object",
      "file:/tmp/a.sql",
    ]);
    expect(restored.activeTabId).toBe("stub:object");
    expect(restored.activeCenterTabId).toBe("stub:object");
  });

  it("persists Database Source Document sticky attachment across reload", () => {
    saveProjectTabs("proj-source", {
      openTabs: [
        {
          id: "database-source:HR.PACKAGE.ORDER_API:combined",
          kind: "sql",
          title: "ORDER_API",
          path: "/tmp/order_api.pkg",
          content: "create package order_api as end;\n/\n",
          databaseSource: {
            target: {
              connectionProfileId: "profile-1",
              workingSchema: "HR",
              owner: "HR",
              objectTypes: ["PACKAGE", "PACKAGE_BODY"],
              name: "ORDER_API",
            },
            attachmentState: "attached",
            baselineFingerprints: [
              {
                owner: "HR",
                name: "ORDER_API",
                unit_type: "PACKAGE",
                digest: "abc",
                exists: true,
                status: "VALID",
              },
            ],
          },
        },
        {
          id: "sql:unconnected",
          kind: "sql",
          title: "local.pkg",
          content: "create package local as end;",
          databaseSource: {
            target: {
              connectionProfileId: null,
              workingSchema: null,
              owner: "UNKNOWN",
              objectTypes: [],
              name: "LOCAL",
            },
            attachmentState: "unconnected",
          },
        },
      ],
      activeTabId: "database-source:HR.PACKAGE.ORDER_API:combined",
      activeCenterTabId: "database-source:HR.PACKAGE.ORDER_API:combined",
    });

    const restored = loadProjectTabs("proj-source");
    expect(restored.openTabs[0]?.databaseSource).toMatchObject({
      attachmentState: "attached",
      target: { connectionProfileId: "profile-1", owner: "HR", name: "ORDER_API" },
    });
    expect(restored.openTabs[0]?.content).toContain("order_api");
    expect(restored.openTabs[1]?.databaseSource?.attachmentState).toBe("unconnected");
    expect(restored.openTabs[1]?.databaseSource?.target.connectionProfileId).toBeNull();
  });

  it("does not restore mappings or schema as persisted workspace tabs", () => {
    saveProjectTabs("proj-1", {
      openTabs: [
        { id: "mission", kind: "mission", title: "Mission" },
        { id: "mappings", kind: "mappings", title: "Mappings" },
        { id: "schema", kind: "schema", title: "Schema" },
        { id: "sql", kind: "sql", title: "SQL Editor" },
      ],
      activeTabId: "mappings",
      activeCenterTabId: "mappings",
      activeInspectorTabId: "mappings",
    });

    const restored = loadProjectTabs("proj-1");
    expect(restored.openTabs.map((tab) => tab.kind)).toEqual(["mission", "sql"]);
    expect(restored.activeTabId).toBe("mission");
    expect(restored.activeCenterTabId).toBeUndefined();
    expect(restored.activeInspectorTabId).toBeUndefined();
  });
});
