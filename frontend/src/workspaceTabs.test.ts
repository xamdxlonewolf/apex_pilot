import { describe, expect, it } from "vitest";

import { pickAdjacentEditorTab } from "./workspaceTabs";

const isEditor = (tab: { kind: string }) =>
  tab.kind === "sql" || tab.kind === "file" || tab.kind === "object";

describe("pickAdjacentEditorTab", () => {
  it("prefers the next editor after the closed index when another file remains", () => {
    const before = [
      { id: "sql", kind: "sql" },
      { id: "a", kind: "file" },
      { id: "b", kind: "file" },
    ];
    const after = [
      { id: "sql", kind: "sql" },
      { id: "b", kind: "file" },
    ];
    expect(pickAdjacentEditorTab(before, after, 1, isEditor)?.id).toBe("b");
  });

  it("falls back to the previous editor when closing the last file", () => {
    const before = [
      { id: "sql", kind: "sql" },
      { id: "a", kind: "file" },
      { id: "b", kind: "file" },
    ];
    const after = [
      { id: "sql", kind: "sql" },
      { id: "a", kind: "file" },
    ];
    expect(pickAdjacentEditorTab(before, after, 2, isEditor)?.id).toBe("a");
  });

  it("falls back to SQL when it is the only remaining editor", () => {
    const before = [
      { id: "sql", kind: "sql" },
      { id: "a", kind: "file" },
    ];
    const after = [{ id: "sql", kind: "sql" }];
    expect(pickAdjacentEditorTab(before, after, 1, isEditor)?.id).toBe("sql");
  });
});
