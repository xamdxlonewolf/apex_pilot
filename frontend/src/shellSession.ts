/** Session-only Focus shell visibility + drawer open policy (calm Focus map). */

import type { FocusMode } from "./focusMode";

export type DrawerSide = "left" | "right";

export type DrawerId = "explorer" | "inspector" | "database";

export type ShellPanelId = DrawerId | "mission" | "console";

export type DrawerSidePrefs = Readonly<{
  explorerDrawerSide: DrawerSide;
  inspectorDrawerSide: DrawerSide;
  databaseDrawerSide: DrawerSide;
}>;

export type ShellSessionState = Readonly<{
  explorerOpen: boolean;
  inspectorOpen: boolean;
  databaseOpen: boolean;
  /** Per-Focus Mission override; undefined means use Focus default. */
  missionOverrideByFocus: Readonly<Partial<Record<FocusMode, boolean>>>;
}>;

export const defaultMissionVisible = (mode: FocusMode): boolean =>
  mode === "agent" || mode === "review";

/** Explorer is a Workspace peer only in Files Focus; elsewhere it is a drawer. */
export const explorerIsPeer = (mode: FocusMode): boolean => mode === "files";

export const missionVisible = (session: ShellSessionState, mode: FocusMode): boolean =>
  session.missionOverrideByFocus[mode] ?? defaultMissionVisible(mode);

export const initialShellSession = (mode: FocusMode = "agent"): ShellSessionState => ({
  explorerOpen: explorerIsPeer(mode),
  inspectorOpen: false,
  databaseOpen: false,
  missionOverrideByFocus: {},
});

/**
 * On Focus Mode entry: apply Mission default unless overridden; Explorer peer
 * open in Files else closed drawer; Inspector closed. Database open state is
 * left alone (user may keep it across Focus switches).
 */
export const applyFocusTransition = (
  session: ShellSessionState,
  nextFocus: FocusMode,
): ShellSessionState => ({
  ...session,
  explorerOpen: explorerIsPeer(nextFocus),
  inspectorOpen: false,
});

export const drawerSideFor = (
  prefs: DrawerSidePrefs,
  drawer: DrawerId,
): DrawerSide => {
  switch (drawer) {
    case "explorer":
      return prefs.explorerDrawerSide;
    case "inspector":
      return prefs.inspectorDrawerSide;
    case "database":
      return prefs.databaseDrawerSide;
  }
};

/** Same-side mutual exclusion for Inspector ↔ Database. */
export const withDrawerOpen = (
  session: ShellSessionState,
  prefs: DrawerSidePrefs,
  drawer: DrawerId,
  open: boolean,
): ShellSessionState => {
  if (!open) {
    return {
      ...session,
      explorerOpen: drawer === "explorer" ? false : session.explorerOpen,
      inspectorOpen: drawer === "inspector" ? false : session.inspectorOpen,
      databaseOpen: drawer === "database" ? false : session.databaseOpen,
    };
  }

  let next: ShellSessionState = {
    ...session,
    explorerOpen: drawer === "explorer" ? true : session.explorerOpen,
    inspectorOpen: drawer === "inspector" ? true : session.inspectorOpen,
    databaseOpen: drawer === "database" ? true : session.databaseOpen,
  };

  if (drawer === "inspector" || drawer === "database") {
    const side = drawerSideFor(prefs, drawer);
    const other: DrawerId = drawer === "inspector" ? "database" : "inspector";
    if (drawerSideFor(prefs, other) === side) {
      next = {
        ...next,
        inspectorOpen: other === "inspector" ? false : next.inspectorOpen,
        databaseOpen: other === "database" ? false : next.databaseOpen,
      };
    }
  }

  return next;
};

export const toggleDrawer = (
  session: ShellSessionState,
  prefs: DrawerSidePrefs,
  drawer: DrawerId,
): ShellSessionState => {
  const currentlyOpen =
    drawer === "explorer"
      ? session.explorerOpen
      : drawer === "inspector"
        ? session.inspectorOpen
        : session.databaseOpen;
  return withDrawerOpen(session, prefs, drawer, !currentlyOpen);
};

export const toggleMissionVisible = (
  session: ShellSessionState,
  mode: FocusMode,
): ShellSessionState => {
  const nextVisible = !missionVisible(session, mode);
  return {
    ...session,
    missionOverrideByFocus: {
      ...session.missionOverrideByFocus,
      [mode]: nextVisible,
    },
  };
};

export type EscapeDismissTarget = "database" | "inspector" | "explorer" | "mission" | null;

/**
 * Escape closes the topmost open drawer (Database → Inspector → Explorer drawer),
 * then Mission only when user-shown in SQL/Files.
 */
export const escapeDismissTarget = (
  session: ShellSessionState,
  mode: FocusMode,
): EscapeDismissTarget => {
  if (session.databaseOpen) {
    return "database";
  }
  if (session.inspectorOpen) {
    return "inspector";
  }
  if (session.explorerOpen && !explorerIsPeer(mode)) {
    return "explorer";
  }
  if ((mode === "sql" || mode === "files") && missionVisible(session, mode)) {
    return "mission";
  }
  return null;
};

export const applyEscapeDismiss = (
  session: ShellSessionState,
  mode: FocusMode,
): ShellSessionState => {
  const target = escapeDismissTarget(session, mode);
  if (!target) {
    return session;
  }
  if (target === "mission") {
    return {
      ...session,
      missionOverrideByFocus: {
        ...session.missionOverrideByFocus,
        [mode]: false,
      },
    };
  }
  return {
    ...session,
    explorerOpen: target === "explorer" ? false : session.explorerOpen,
    inspectorOpen: target === "inspector" ? false : session.inspectorOpen,
    databaseOpen: target === "database" ? false : session.databaseOpen,
  };
};

/** Panel visibility for Layout Chrome checked state. */
export const panelIsVisible = (
  session: ShellSessionState,
  mode: FocusMode,
  panel: ShellPanelId,
  showConsole: boolean,
): boolean => {
  switch (panel) {
    case "explorer":
      return session.explorerOpen;
    case "inspector":
      return session.inspectorOpen;
    case "database":
      return session.databaseOpen;
    case "mission":
      return missionVisible(session, mode);
    case "console":
      return showConsole;
  }
};
