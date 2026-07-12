import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickOpen } from "./QuickOpen";
import {
  browserFsFromTree,
  installBrowserProjectFs,
  resetBrowserProjectFsForTests,
} from "./projectFs";
import {
  collectProjectFileItems,
  filterQuickOpenItems,
  matchQuickOpenShortcut,
  mergeQuickOpenItems,
  schemaTablesToQuickOpenItems,
  type QuickOpenItem,
} from "./quickOpenModel";

describe("quickOpen helpers", () => {
  it("matches Ctrl/Cmd+P without Shift for Quick Open", () => {
    expect(
      matchQuickOpenShortcut({
        key: "p",
        code: "KeyP",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true);
    expect(
      matchQuickOpenShortcut({
        key: "P",
        code: "KeyP",
        ctrlKey: false,
        metaKey: true,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true);
    expect(
      matchQuickOpenShortcut({
        key: "p",
        code: "KeyP",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(false);
  });

  it("filters files and objects by query", () => {
    const items: QuickOpenItem[] = [
      {
        id: "file:/demo/README.md",
        kind: "file",
        label: "README.md",
        detail: "/demo/README.md",
        path: "/demo/README.md",
      },
      {
        id: "object:HR.TABLE.EMPLOYEES",
        kind: "object",
        label: "EMPLOYEES",
        detail: "HR.EMPLOYEES",
        objectName: "EMPLOYEES",
        objectType: "TABLE",
        schemaName: "HR",
      },
    ];
    expect(filterQuickOpenItems(items, "readme").map((item) => item.id)).toEqual([
      "file:/demo/README.md",
    ]);
    expect(filterQuickOpenItems(items, "EMP").map((item) => item.id)).toEqual([
      "object:HR.TABLE.EMPLOYEES",
    ]);
  });
});

describe("Quick Open browser fallback", () => {
  afterEach(() => {
    resetBrowserProjectFsForTests();
  });

  it("collects known project files from the browser project FS", async () => {
    installBrowserProjectFs(
      browserFsFromTree({
        "/demo": [
          { name: "README.md", kind: "file" },
          { name: "src", kind: "dir" },
          { name: "node_modules", kind: "dir" },
        ],
        "/demo/src": [{ name: "main.ts", kind: "file" }],
        "/demo/node_modules": [{ name: "pkg", kind: "dir" }],
      }),
    );

    const files = await collectProjectFileItems("/demo", { showJunk: false });
    expect(files.map((item) => item.label).sort()).toEqual(["README.md", "main.ts"]);
  });

  it("opens Quick Open and selects a known file under browser fallback", async () => {
    installBrowserProjectFs(
      browserFsFromTree(
        {
          "/demo": [
            { name: "README.md", kind: "file" },
            { name: "src", kind: "dir" },
          ],
          "/demo/src": [{ name: "app.ts", kind: "file" }],
        },
        {
          "/demo/README.md": "# demo",
          "/demo/src/app.ts": "export {}",
        },
      ),
    );

    const files = await collectProjectFileItems("/demo");
    const objects = schemaTablesToQuickOpenItems("HR", [{ table_name: "EMPLOYEES" }]);
    const items = mergeQuickOpenItems(files, objects);
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(<QuickOpen open items={items} onSelect={onSelect} onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: /quick open/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /README\.md/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /EMPLOYEES/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /app\.ts/i }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "file",
        label: "app.ts",
        path: "/demo/src/app.ts",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("selects a known schema object from Quick Open", async () => {
    const objects = schemaTablesToQuickOpenItems("HR", [
      { table_name: "DEPARTMENTS" },
      { table_name: "EMPLOYEES" },
    ]);
    const onSelect = vi.fn();

    render(
      <QuickOpen open items={objects} onSelect={onSelect} onClose={() => undefined} />,
    );

    fireEvent.change(screen.getByTestId("quick-open-input"), {
      target: { value: "EMPLOYEES" },
    });
    fireEvent.click(screen.getByRole("option", { name: /EMPLOYEES/i }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "object",
        objectName: "EMPLOYEES",
        schemaName: "HR",
        objectType: "TABLE",
      }),
    );
  });
});

describe("Quick Open Ctrl+P shell wiring", () => {
  afterEach(() => {
    resetBrowserProjectFsForTests();
  });

  it("opens Quick Open from Ctrl+P via the harness used by the workspace", async () => {
    const { QuickOpenHost } = await import("./QuickOpenHost");

    installBrowserProjectFs(
      browserFsFromTree({
        "/demo": [{ name: "README.md", kind: "file" }],
      }),
    );

    const onSelect = vi.fn();
    render(
      <QuickOpenHost
        rootPath="/demo"
        showJunk={false}
        objects={schemaTablesToQuickOpenItems("HR", [{ table_name: "EMPLOYEES" }])}
        onSelect={onSelect}
      />,
    );

    expect(screen.queryByRole("dialog", { name: /quick open/i })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "p", ctrlKey: true, code: "KeyP" });
    expect(await screen.findByRole("dialog", { name: /quick open/i })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("option", { name: /README\.md/i }));
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "file", label: "README.md" }),
      );
    });
  });
});
