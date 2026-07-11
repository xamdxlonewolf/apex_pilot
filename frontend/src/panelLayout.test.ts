import { describe, expect, it } from "vitest";

import {
  clampConsoleHeight,
  clampExplorerWidth,
  clampInspectorWidth,
  matchPanelToggleShortcut,
} from "./panelLayout";
import { defaultProfileLayout, togglePanelVisibility } from "./prefs";

describe("panelLayout", () => {
  it("clamps panel sizes to Spec minima", () => {
    expect(clampExplorerWidth(100)).toBe(240);
    expect(clampInspectorWidth(100)).toBe(320);
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
        key: "`",
        code: "Backquote",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe("console");
  });

  it("defaults console collapsed per Spec startup layout", () => {
    const layout = defaultProfileLayout();
    expect(layout.showExplorer).toBe(true);
    expect(layout.showMission).toBe(true);
    expect(layout.showInspector).toBe(true);
    expect(layout.showConsole).toBe(false);
    expect(togglePanelVisibility(layout, "console").showConsole).toBe(true);
  });
});
