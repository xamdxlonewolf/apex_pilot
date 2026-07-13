import { describe, expect, it } from "vitest";

import {
  clampConsoleHeight,
  clampDatabaseWidth,
  clampExplorerWidth,
  clampInspectorWidth,
  clampMissionWidth,
  MISSION_DEFAULT_WIDTH,
  MISSION_MIN_WIDTH,
  matchPanelToggleShortcut,
} from "./panelLayout";
import { defaultProfileLayout } from "./prefs";

describe("panelLayout", () => {
  it("clamps panel sizes to Spec minima", () => {
    expect(clampExplorerWidth(100)).toBe(240);
    expect(clampInspectorWidth(100)).toBe(320);
    expect(clampDatabaseWidth(100)).toBe(280);
    expect(clampMissionWidth(100, 1000)).toBe(MISSION_MIN_WIDTH);
    expect(clampMissionWidth(900, 1000)).toBe(680);
    expect(clampConsoleHeight(50, 900)).toBe(120);
    expect(clampConsoleHeight(800, 900)).toBe(450);
  });

  it("matches Spec General panel-toggle shortcuts", () => {
    expect(
      matchPanelToggleShortcut({
        key: "b",
        code: "KeyB",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe("explorer");
    expect(
      matchPanelToggleShortcut({
        key: "I",
        code: "KeyI",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe("inspector");
    expect(
      matchPanelToggleShortcut({
        key: "M",
        code: "KeyM",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe("mission");
    expect(
      matchPanelToggleShortcut({
        key: "D",
        code: "KeyD",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe("database");
    expect(
      matchPanelToggleShortcut({
        key: "`",
        code: "Backquote",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe("console");
  });

  it("defaults console collapsed and drawer sides profile-ready", () => {
    const layout = defaultProfileLayout();
    expect(layout.showConsole).toBe(false);
    expect(layout.missionWidth).toBe(MISSION_DEFAULT_WIDTH);
    expect(layout.explorerDrawerSide).toBe("left");
    expect(layout.inspectorDrawerSide).toBe("right");
    expect(layout.databaseDrawerSide).toBe("right");
  });
});
