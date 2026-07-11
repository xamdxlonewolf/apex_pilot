import { useEffect, useState } from "react";

import { type FileTreeNode, listDirectory } from "./projectFs";

type FileTreeProps = Readonly<{
  rootPath: string;
  showJunk: boolean;
  onToggleJunk: () => void;
  onOpenFile: (node: FileTreeNode) => void;
}>;

type TreeBranchProps = Readonly<{
  path: string;
  depth: number;
  showJunk: boolean;
  onOpenFile: (node: FileTreeNode) => void;
}>;

const ProtectedMarkers = () => (
  <>
    <em>protected</em>
    <em>read-only</em>
  </>
);

const TreeBranch = ({ path, depth, showJunk, onOpenFile }: TreeBranchProps) => {
  const [nodes, setNodes] = useState<FileTreeNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listDirectory(path, { depth, showJunk })
      .then((entries) => {
        if (active) {
          setNodes(entries);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not read directory.");
        }
      });
    return () => {
      active = false;
    };
  }, [depth, path, showJunk]);

  if (error) {
    return <p className="pane-muted">{error}</p>;
  }

  if (nodes.length === 0) {
    return <p className="pane-muted">{depth === 0 ? "No visible files." : "Empty"}</p>;
  }

  return (
    <ul className="file-tree" aria-label={depth === 0 ? "Project files" : undefined}>
      {nodes.map((node) => (
        <li key={node.path} className={node.protected ? "file-tree-item file-tree-item--protected" : "file-tree-item"}>
          {node.kind === "dir" ? (
            <>
              <button
                type="button"
                className="file-tree-button"
                onClick={() =>
                  setExpanded((current) => ({ ...current, [node.path]: !current[node.path] }))
                }
              >
                <span aria-hidden="true">{expanded[node.path] ? "▾" : "▸"}</span>
                <span>{node.name}</span>
                {node.protected ? <em>APEX export</em> : null}
                {node.protected ? <ProtectedMarkers /> : null}
                {node.junk ? <em>junk</em> : null}
              </button>
              {expanded[node.path] ? (
                <TreeBranch
                  path={node.path}
                  depth={depth + 1}
                  showJunk={showJunk}
                  onOpenFile={onOpenFile}
                />
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="file-tree-button"
              onClick={() => onOpenFile(node)}
              title={
                node.protected
                  ? "Protected APEX export artifact — read-only preview."
                  : node.path
              }
            >
              <span aria-hidden="true">·</span>
              <span>{node.name}</span>
              {node.protected ? <ProtectedMarkers /> : null}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};

export const FileTree = ({ rootPath, showJunk, onToggleJunk, onOpenFile }: FileTreeProps) => (
  <aside className="ide-pane ide-pane--left" aria-label="Project file tree">
    <div className="pane-header">
      <strong>Files</strong>
      <label className="chrome-check">
        <input type="checkbox" checked={showJunk} onChange={onToggleJunk} />
        Show junk
      </label>
    </div>
    <div className="pane-body">
      <TreeBranch path={rootPath} depth={0} showJunk={showJunk} onOpenFile={onOpenFile} />
    </div>
  </aside>
);
