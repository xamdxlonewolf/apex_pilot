import { useEffect, type ReactNode } from "react";

import {
  type BackendConfig,
  type SchemaSummary,
} from "./backend";
import { FileTree } from "./FileTree";
import { type ActivityRailId } from "./focusMode";
import { type FileTreeNode } from "./projectFs";
import { SchemaBrowser } from "./SchemaBrowser";
import { StubSurface } from "./StubSurface";
import { stubActionProps } from "./stubConvention";

/** Explorer posture driven by Activity Rail (plus Quick Open jumps). */
export type ExplorerSectionId = ActivityRailId;

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
  { id: "database", title: "Database", stub: false },
  {
    id: "apex",
    title: "APEX",
    stub: true,
    secondary: "APEX application browsing arrives with APEX metadata integration.",
  },
  {
    id: "review",
    title: "Review",
    stub: true,
    secondary: "Review Explorer posture arrives with AI SQL review navigation.",
  },
];

export type ExplorerSchemaProps = Readonly<{
  backendConfig: BackendConfig;
  connectedConnection: string | null;
  isBackendOnline: boolean;
  projectSchemaOverride: string | null;
  workingSchema: string;
  onWorkingSchemaChange: (schema: string, options?: { persist?: boolean }) => void;
  onActivityRefresh: () => Promise<void>;
  onSaveSummary?: (summary: SchemaSummary) => void;
  onSummaryChange?: (summary: SchemaSummary | null) => void;
}>;

type ExplorerProps = Readonly<{
  rootPath: string;
  showJunk: boolean;
  onToggleJunk: () => void;
  onOpenFile: (node: FileTreeNode) => void;
  schema: ExplorerSchemaProps;
  /** Activity Rail posture that drives the Explorer body. */
  activePosture: ExplorerSectionId;
  /** When set, Explorer requests a posture jump (Quick Open object). */
  focusSection?: ExplorerSectionId | null;
  onFocusSectionHandled?: () => void;
  focusedObjectName?: string | null;
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
  schema,
}: Readonly<{
  posture: ExplorerPosture;
  rootPath: string;
  showJunk: boolean;
  onToggleJunk: () => void;
  onOpenFile: (node: FileTreeNode) => void;
  schema: ExplorerSchemaProps;
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
  if (posture.id === "database") {
    return (
      <div className="explorer-database">
        <SchemaBrowser
          backendConfig={schema.backendConfig}
          connectedConnection={schema.connectedConnection}
          isBackendOnline={schema.isBackendOnline}
          projectSchemaOverride={schema.projectSchemaOverride}
          workingSchema={schema.workingSchema}
          onWorkingSchemaChange={schema.onWorkingSchemaChange}
          onActivityRefresh={schema.onActivityRefresh}
          onSaveSummary={schema.onSaveSummary}
          onSummaryChange={schema.onSummaryChange}
        />
      </div>
    );
  }
  return <StubSectionBody posture={posture} />;
};

export const Explorer = ({
  rootPath,
  showJunk,
  onToggleJunk,
  onOpenFile,
  schema,
  activePosture,
  focusSection = null,
  onFocusSectionHandled,
  focusedObjectName = null,
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
      </div>
      {focusedObjectName && posture.id === "database" ? (
        <p className="pane-muted explorer-focused-object" data-testid="explorer-focused-object">
          Focused object: {focusedObjectName}
        </p>
      ) : null}
      <div className="pane-body explorer-section-body" data-section={posture.id}>
        <SectionBody
          posture={posture}
          rootPath={rootPath}
          showJunk={showJunk}
          onToggleJunk={onToggleJunk}
          onOpenFile={onOpenFile}
          schema={schema}
        />
      </div>
    </aside>
  );
};
