import { useEffect, type ReactNode } from "react";

import { ApexBrowser, type ApexOpenTarget, type ApexWorkspaceMappingItem } from "./ApexBrowser";
import { FileTree } from "./FileTree";
import { type ActivityRailId } from "./focusMode";
import { type FileTreeNode } from "./projectFs";
import { StubSurface } from "./StubSurface";
import { stubActionProps } from "./stubConvention";

/** Explorer posture driven by Activity Rail (Database is a dedicated drawer). */
export type ExplorerSectionId = Exclude<ActivityRailId, "database">;

type ExplorerPosture = Readonly<{
  id: ExplorerSectionId;
  title: string;
  stub: boolean;
  secondary?: string;
}>;

const EXPLORER_POSTURES: ReadonlyArray<ExplorerPosture> = [
  { id: "files", title: "Files", stub: false },
  {
    id: "agent",
    title: "Agent",
    stub: true,
    secondary: "Agent Explorer posture arrives with Mission-linked navigation.",
  },
  {
    id: "code",
    title: "Code",
    stub: true,
    secondary: "Code posture arrives with repository object browsing.",
  },
  { id: "apex", title: "APEX", stub: false },
  {
    id: "review",
    title: "Review",
    stub: true,
    secondary: "Review Explorer posture arrives with AI SQL review navigation.",
  },
];

type ExplorerProps = Readonly<{
  rootPath: string;
  showJunk: boolean;
  onToggleJunk: () => void;
  onOpenFile: (node: FileTreeNode) => void;
  apexMappings: ReadonlyArray<ApexWorkspaceMappingItem>;
  onOpenApex: (target: ApexOpenTarget) => void;
  /** Activity Rail posture that drives the Explorer body (not Database). */
  activePosture: ExplorerSectionId;
  /** When set, Explorer requests a posture jump. */
  focusSection?: ExplorerSectionId | null;
  onFocusSectionHandled?: () => void;
  /** Optional close control when Explorer is shown as a drawer. */
  onClose?: () => void;
}>;

const StubSectionBody = ({ posture }: Readonly<{ posture: ExplorerPosture }>) => (
  <StubSurface
    title={posture.title}
    secondary={posture.secondary}
    bodyClassName="explorer-stub-body"
    actions={
      <div className="explorer-stub-actions">
        <button type="button" className="chrome-button" {...stubActionProps()}>
          Refresh
        </button>
        <button type="button" className="chrome-button" {...stubActionProps()}>
          Open
        </button>
      </div>
    }
  />
);

const SectionBody = ({
  posture,
  rootPath,
  showJunk,
  onToggleJunk,
  onOpenFile,
  apexMappings,
  onOpenApex,
}: Readonly<{
  posture: ExplorerPosture;
  rootPath: string;
  showJunk: boolean;
  onToggleJunk: () => void;
  onOpenFile: (node: FileTreeNode) => void;
  apexMappings: ReadonlyArray<ApexWorkspaceMappingItem>;
  onOpenApex: (target: ApexOpenTarget) => void;
}>): ReactNode => {
  if (posture.id === "files") {
    return (
      <FileTree
        rootPath={rootPath}
        showJunk={showJunk}
        onToggleJunk={onToggleJunk}
        onOpenFile={onOpenFile}
        embedded
      />
    );
  }
  if (posture.id === "apex") {
    return <ApexBrowser mappings={apexMappings} onOpenApex={onOpenApex} />;
  }
  return <StubSectionBody posture={posture} />;
};

export const Explorer = ({
  rootPath,
  showJunk,
  onToggleJunk,
  onOpenFile,
  apexMappings,
  onOpenApex,
  activePosture,
  focusSection = null,
  onFocusSectionHandled,
  onClose,
}: ExplorerProps) => {
  const posture =
    EXPLORER_POSTURES.find((item) => item.id === activePosture) ?? EXPLORER_POSTURES[0];

  useEffect(() => {
    if (!focusSection) {
      return;
    }
    onFocusSectionHandled?.();
  }, [focusSection, onFocusSectionHandled]);

  return (
    <aside className="ide-pane ide-pane--left" aria-label="Explorer navigation">
      <div className="pane-header">
        <strong>{posture.title}</strong>
        {onClose ? (
          <button
            type="button"
            className="chrome-button shell-drawer-close"
            aria-label="Close Explorer"
            onClick={onClose}
          >
            ×
          </button>
        ) : null}
      </div>
      <div className="pane-body">
        <SectionBody
          posture={posture}
          rootPath={rootPath}
          showJunk={showJunk}
          onToggleJunk={onToggleJunk}
          onOpenFile={onOpenFile}
          apexMappings={apexMappings}
          onOpenApex={onOpenApex}
        />
      </div>
    </aside>
  );
};
