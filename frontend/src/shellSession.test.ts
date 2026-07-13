/** Session-only Focus shell visibility + drawer open policy (calm Focus map). */

import { describe, expect, it } from "vitest";

import {
  applyEscapeDismiss,
  applyFocusTransition,
  defaultMissionVisible,
  escapeDismissTarget,
  explorerIsPeer,
  initialShellSession,
  missionVisible,
  panelIsVisible,
  toggleDrawer,
  toggleMissionVisible,
  withDrawerOpen,
} from "./shellSession";

describe("shellSession", () => {
  it("defaults Mission visible in Agent/Review and hidden in SQL/Files", () => {
    expect(defaultMissionVisible("agent")).toBe(true);
    expect(defaultMissionVisible("review")).toBe(true);
    expect(defaultMissionVisible("sql")).toBe(false);
    expect(defaultMissionVisible("files")).toBe(false);
  });

  it("treats Explorer as peer only in Files Focus", () => {
    expect(explorerIsPeer("files")).toBe(true);
    expect(explorerIsPeer("agent")).toBe(false);
    expect(explorerIsPeer("sql")).toBe(false);
    expect(explorerIsPeer("review")).toBe(false);
  });

  it("applies Focus transition: Files opens Explorer peer; others close Explorer + Inspector", () => {
    const open = {
      ...initialShellSession("agent"),
      explorerOpen: true,
      inspectorOpen: true,
      databaseOpen: true,
    };
    const toFiles = applyFocusTransition(open, "files");
    expect(toFiles.explorerOpen).toBe(true);
    expect(toFiles.inspectorOpen).toBe(false);
    expect(toFiles.databaseOpen).toBe(true);

    const toSql = applyFocusTransition(open, "sql");
    expect(toSql.explorerOpen).toBe(false);
    expect(toSql.inspectorOpen).toBe(false);
    expect(toSql.databaseOpen).toBe(true);
  });

  it("remembers per-Focus Mission override for the session", () => {
    let session = initialShellSession("sql");
    expect(missionVisible(session, "sql")).toBe(false);
    session = toggleMissionVisible(session, "sql");
    expect(missionVisible(session, "sql")).toBe(true);
    session = applyFocusTransition(session, "files");
    expect(missionVisible(session, "files")).toBe(false);
    session = applyFocusTransition(session, "sql");
    expect(missionVisible(session, "sql")).toBe(true);
  });

  it("excludes Inspector and Database on the same side", () => {
    const prefs = {
      explorerDrawerSide: "left" as const,
      inspectorDrawerSide: "right" as const,
      databaseDrawerSide: "right" as const,
    };
    let session = initialShellSession("agent");
    session = withDrawerOpen(session, prefs, "inspector", true);
    expect(session.inspectorOpen).toBe(true);
    session = withDrawerOpen(session, prefs, "database", true);
    expect(session.databaseOpen).toBe(true);
    expect(session.inspectorOpen).toBe(false);

    const splitPrefs = { ...prefs, databaseDrawerSide: "left" as const };
    session = withDrawerOpen(session, splitPrefs, "inspector", true);
    expect(session.inspectorOpen).toBe(true);
    expect(session.databaseOpen).toBe(true);
  });

  it("toggles drawers and Escape dismisses topmost then Mission", () => {
    const prefs = {
      explorerDrawerSide: "left" as const,
      inspectorDrawerSide: "right" as const,
      databaseDrawerSide: "right" as const,
    };
    let session = initialShellSession("agent");
    session = withDrawerOpen(session, prefs, "database", true);
    expect(session.databaseOpen).toBe(true);
    session = withDrawerOpen(session, prefs, "inspector", true);
    // Same-side exclusion: Inspector opens, Database closes.
    expect(session.inspectorOpen).toBe(true);
    expect(session.databaseOpen).toBe(false);
    expect(escapeDismissTarget(session, "agent")).toBe("inspector");
    session = applyEscapeDismiss(session, "agent");
    expect(session.inspectorOpen).toBe(false);

    session = withDrawerOpen(session, prefs, "database", true);
    expect(escapeDismissTarget(session, "agent")).toBe("database");
    session = applyEscapeDismiss(session, "agent");
    expect(session.databaseOpen).toBe(false);

    session = toggleDrawer(session, prefs, "explorer");
    expect(session.explorerOpen).toBe(true);
    expect(escapeDismissTarget(session, "agent")).toBe("explorer");
    session = applyEscapeDismiss(session, "agent");
    expect(session.explorerOpen).toBe(false);

    // Agent Mission peer is not Escape-dismissed; SQL/Files user-shown Mission is.
    expect(escapeDismissTarget(session, "agent")).toBe(null);
    session = toggleMissionVisible(session, "sql");
    expect(escapeDismissTarget(session, "sql")).toBe("mission");
    session = applyEscapeDismiss(session, "sql");
    expect(missionVisible(session, "sql")).toBe(false);
  });

  it("reports Layout Chrome panel visibility", () => {
    const session = {
      ...initialShellSession("agent"),
      inspectorOpen: true,
      databaseOpen: false,
    };
    expect(panelIsVisible(session, "agent", "mission", false)).toBe(true);
    expect(panelIsVisible(session, "agent", "inspector", false)).toBe(true);
    expect(panelIsVisible(session, "agent", "database", false)).toBe(false);
    expect(panelIsVisible(session, "agent", "console", true)).toBe(true);
  });
});
