import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FileTree } from "./FileTree";
import {
  browserFsFromTree,
  installBrowserProjectFs,
  isJunkEntry,
  isRootApexExportSql,
  listDirectory,
  resetBrowserProjectFsForTests,
} from "./projectFs";
import { defaultProfileLayout } from "./prefs";

describe("projectFs Explorer helpers", () => {
  afterEach(() => {
    resetBrowserProjectFsForTests();
  });

  it("hides junk by default and marks APEX export folders / root f*.sql as protected", async () => {
    expect(defaultProfileLayout().showJunkFiles).toBe(false);
    expect(isJunkEntry("node_modules", "dir")).toBe(true);
    expect(isJunkEntry(".DS_Store", "file")).toBe(true);
    expect(isJunkEntry(".cache", "dir")).toBe(true);
    expect(isJunkEntry(".env", "file")).toBe(true);
    expect(isRootApexExportSql("f191.sql", 0)).toBe(true);
    expect(isRootApexExportSql("f191.sql", 1)).toBe(false);

    installBrowserProjectFs(
      browserFsFromTree({
        "/demo": [
          { name: "apex", kind: "dir" },
          { name: "f191.sql", kind: "file" },
          { name: "README.md", kind: "file" },
          { name: "node_modules", kind: "dir" },
          { name: ".DS_Store", kind: "file" },
          { name: ".cache", kind: "dir" },
          { name: ".env", kind: "file" },
        ],
      }),
    );

    const hiddenJunk = await listDirectory("/demo", { depth: 0, showJunk: false });
    expect(hiddenJunk.map((node) => node.name)).toEqual(["apex", "f191.sql", "README.md"]);
    expect(hiddenJunk.find((node) => node.name === "apex")?.protected).toBe(true);
    expect(hiddenJunk.find((node) => node.name === "f191.sql")?.protected).toBe(true);
    expect(hiddenJunk.find((node) => node.name === "README.md")?.protected).toBe(false);

    const withJunk = await listDirectory("/demo", { depth: 0, showJunk: true });
    expect(withJunk.map((node) => node.name)).toEqual([
      ".cache",
      "apex",
      "node_modules",
      ".DS_Store",
      ".env",
      "f191.sql",
      "README.md",
    ]);
  });
});

describe("FileTree browser fallback", () => {
  afterEach(() => {
    resetBrowserProjectFsForTests();
  });

  it("renders Explorer project files with protected markers under browser fallback", async () => {
    installBrowserProjectFs(
      browserFsFromTree({
        "C:/tmp/demo": [
          { name: "apex", kind: "dir" },
          { name: "f42.sql", kind: "file" },
          { name: "src", kind: "dir" },
          { name: ".env", kind: "file" },
          { name: "node_modules", kind: "dir" },
        ],
        "C:/tmp/demo/src": [{ name: "main.ts", kind: "file" }],
      }),
    );

    const onOpenFile = vi.fn();
    const onToggleJunk = vi.fn();
    render(
      <FileTree
        rootPath="C:/tmp/demo"
        showJunk={false}
        onToggleJunk={onToggleJunk}
        onOpenFile={onOpenFile}
      />,
    );

    expect(screen.getByLabelText("Project file tree")).toBeInTheDocument();
    expect(await screen.findByText("apex")).toBeInTheDocument();
    expect(screen.getByText("APEX export")).toBeInTheDocument();
    expect(screen.getByText("f42.sql")).toBeInTheDocument();
    expect(screen.getAllByText("protected")).toHaveLength(2);
    expect(screen.getAllByText("read-only")).toHaveLength(2);
    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.queryByText("node_modules")).not.toBeInTheDocument();
    expect(screen.queryByText(".env")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("src"));
    expect(await screen.findByText("main.ts")).toBeInTheDocument();

    fireEvent.click(screen.getByText("f42.sql"));
    expect(onOpenFile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "f42.sql",
        protected: true,
        kind: "file",
      }),
    );

    fireEvent.click(screen.getByLabelText(/show junk/i));
    expect(onToggleJunk).toHaveBeenCalled();
  });

  it("shows junk entries when showJunk is enabled", async () => {
    installBrowserProjectFs(
      browserFsFromTree({
        "/proj": [
          { name: "README.md", kind: "file" },
          { name: ".env", kind: "file" },
          { name: "node_modules", kind: "dir" },
        ],
      }),
    );

    const { rerender } = render(
      <FileTree
        rootPath="/proj"
        showJunk={false}
        onToggleJunk={() => undefined}
        onOpenFile={() => undefined}
      />,
    );

    expect(await screen.findByText("README.md")).toBeInTheDocument();
    expect(screen.queryByText("node_modules")).not.toBeInTheDocument();
    expect(screen.queryByText(".env")).not.toBeInTheDocument();

    rerender(
      <FileTree
        rootPath="/proj"
        showJunk
        onToggleJunk={() => undefined}
        onOpenFile={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("node_modules")).toBeInTheDocument();
    });
    expect(screen.getByText(".env")).toBeInTheDocument();
    expect(screen.getByText("junk")).toBeInTheDocument();
  });
});
