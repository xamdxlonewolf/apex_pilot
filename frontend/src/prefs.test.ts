import {
  defaultProfileLayout,
  loadProfileLayout,
  loadProjectTabs,
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
      leftWidth: 320,
      rightWidth: 400,
      consoleHeight: 220,
      showExplorer: false,
      showMission: true,
      showInspector: false,
      showConsole: true,
      showJunkFiles: true,
      skipDestructiveSqlPrompt: true,
    };

    saveProfileLayout(profileId, prefs);
    const restored = loadProfileLayout(profileId);

    expect(restored.density).toBe("comfortable");
    expect(restored.leftWidth).toBe(320);
    expect(restored.rightWidth).toBe(400);
    expect(restored.consoleHeight).toBe(220);
    expect(restored.showExplorer).toBe(false);
    expect(restored.showMission).toBe(true);
    expect(restored.showInspector).toBe(false);
    expect(restored.showConsole).toBe(true);
    expect(restored.showJunkFiles).toBe(true);
    expect(restored.skipDestructiveSqlPrompt).toBe(true);
  });

  it("scopes layout prefs per profile id", () => {
    saveProfileLayout("profile-a", {
      ...defaultProfileLayout(),
      density: "compact",
      showExplorer: false,
    });
    saveProfileLayout("profile-b", {
      ...defaultProfileLayout(),
      density: "comfortable",
      showConsole: true,
    });

    expect(loadProfileLayout("profile-a").density).toBe("compact");
    expect(loadProfileLayout("profile-a").showExplorer).toBe(false);
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
