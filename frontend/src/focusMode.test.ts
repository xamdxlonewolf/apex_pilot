import { describe, expect, it } from "vitest";

import {
  DEFAULT_ACTIVITY_RAIL,
  DEFAULT_FOCUS_MODE,
  applyFocusModeSelection,
  applyRailSelection,
  focusModeForRail,
  focusModeFromWork,
  railForFocusMode,
} from "./focusMode";

describe("focusMode pairing", () => {
  it("defaults to Agent Focus Mode and Agent rail", () => {
    expect(DEFAULT_FOCUS_MODE).toBe("agent");
    expect(DEFAULT_ACTIVITY_RAIL).toBe("agent");
    expect(railForFocusMode("agent")).toBe("agent");
  });

  it("pairs Agent / Files / Review and leaves SQL without a rail update", () => {
    expect(railForFocusMode("files")).toBe("files");
    expect(railForFocusMode("review")).toBe("review");
    expect(railForFocusMode("sql")).toBeNull();
    expect(focusModeForRail("code")).toBeNull();
    expect(focusModeForRail("database")).toBeNull();
    expect(focusModeForRail("apex")).toBeNull();
  });

  it("applies selective rail selection including Review exit to Agent", () => {
    expect(applyRailSelection("files", "agent")).toEqual({
      focusMode: "files",
      rail: "files",
    });
    expect(applyRailSelection("database", "agent")).toEqual({
      focusMode: "agent",
      rail: "database",
    });
    expect(applyRailSelection("code", "review")).toEqual({
      focusMode: "agent",
      rail: "code",
    });
  });

  it("keeps rail posture when selecting SQL Focus Mode", () => {
    expect(applyFocusModeSelection("sql", "database")).toEqual({
      focusMode: "sql",
      rail: "database",
    });
    expect(applyFocusModeSelection("agent", "database")).toEqual({
      focusMode: "agent",
      rail: "agent",
    });
  });
});

describe("focusMode auto-switch", () => {
  it("keeps Agent sticky on editor focus", () => {
    expect(focusModeFromWork("agent", { type: "editor-focus", peer: "sql" })).toBe("agent");
    expect(focusModeFromWork("agent", { type: "editor-focus", peer: "file" })).toBe("agent");
  });

  it("follows SQL ↔ Files once not in sticky Agent", () => {
    expect(focusModeFromWork("sql", { type: "editor-focus", peer: "file" })).toBe("files");
    expect(focusModeFromWork("files", { type: "editor-focus", peer: "sql" })).toBe("sql");
  });

  it("restores Agent when Mission receives focus", () => {
    expect(focusModeFromWork("sql", { type: "mission-focus" })).toBe("agent");
    expect(focusModeFromWork("review", { type: "mission-focus" })).toBe("agent");
  });

  it("exits Review via work-following without auto-entering Review", () => {
    expect(focusModeFromWork("review", { type: "editor-focus", peer: "sql" })).toBe("sql");
    expect(focusModeFromWork("review", { type: "editor-focus", peer: "file" })).toBe("files");
    expect(focusModeFromWork("review", { type: "editor-focus", peer: "other" })).toBe("agent");
  });
});
