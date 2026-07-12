import { describe, expect, it } from "vitest";

import {
  filterCommandActions,
  matchCommandPaletteShortcut,
  type CommandPaletteAction,
} from "./commandPaletteModel";

describe("commandPalette", () => {
  it("matches Ctrl/Cmd+Shift+P for the command palette", () => {
    expect(
      matchCommandPaletteShortcut({
        key: "p",
        code: "KeyP",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(true);
    expect(
      matchCommandPaletteShortcut({
        key: "P",
        code: "KeyP",
        ctrlKey: false,
        metaKey: true,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(true);
    expect(
      matchCommandPaletteShortcut({
        key: "p",
        code: "KeyP",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      matchCommandPaletteShortcut({
        key: "I",
        code: "KeyI",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(false);
  });

  it("filters actions by label query", () => {
    const actions: CommandPaletteAction[] = [
      {
        id: "toggle-explorer",
        label: "View: Toggle Explorer",
        run: () => undefined,
      },
      {
        id: "project-settings",
        label: "Project: Settings",
        run: () => undefined,
      },
    ];
    expect(filterCommandActions(actions, "explorer").map((action) => action.id)).toEqual([
      "toggle-explorer",
    ]);
    expect(filterCommandActions(actions, "PROJECT").map((action) => action.id)).toEqual([
      "project-settings",
    ]);
  });
});
