import { useEffect, useState, type ReactNode } from "react";

import {
  type BackendConfig,
  type SchemaSummary,
} from "./backend";
import { FileTree } from "./FileTree";
import { type FileTreeNode } from "./projectFs";
import { SchemaBrowser } from "./SchemaBrowser";
import { StubBadge, StubSurface } from "./StubSurface";
import { stubActionProps } from "./stubConvention";

export type ExplorerSectionId =
  | "files"
  | "database"
  | "apex"
  | "rest"
  | "favorites"
  | "pinned"
  | "recent";

type ExplorerSection = Readonly<{
  id: ExplorerSectionId;
  title: string;
  stub: boolean;
  secondary?: string;
}>;

const EXPLORER_SECTIONS: ReadonlyArray<ExplorerSection> = [
  { id: "files", title: "Files", stub: false },
  { id: "database", title: "Database", stub: false },
  {
    id: "apex",
    title: "APEX",
    stub: true,
    secondary: "APEX application browsing arrives with APEX metadata integration.",
  },
  {
    id: "rest",
    title: "REST",
    stub: true,
    secondary: "REST module browsing arrives with ORDS metadata integration.",
  },
  {
    id: "favorites",
    title: "Favorites",
    stub: true,
    secondary: "Favorites arrive with persisted Explorer bookmarks.",
  },
  {
    id: "pinned",
    title: "Pinned",
    stub: true,
    secondary: "Pinned items arrive with persisted Explorer pins.",
  },
  {
    id: "recent",
    title: "Recent",
    stub: true,
    secondary: "Recent objects arrive with workspace navigation history.",
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
  /** When set, Explorer switches to this section (Quick Open object jump). */
  focusSection?: ExplorerSectionId | null;
  onFocusSectionHandled?: () => void;
  focusedObjectName?: string | null;
}>;

const StubSectionBody = ({ section }: Readonly<{ section: ExplorerSection }>) => (
  <StubSurface
    title={section.title}
    secondary={section.secondary}
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
  section,
  rootPath,
  showJunk,
  onToggleJunk,
  onOpenFile,
  schema,
}: Readonly<{
  section: ExplorerSection;
  rootPath: string;
  showJunk: boolean;
  onToggleJunk: () => void;
  onOpenFile: (node: FileTreeNode) => void;
  schema: ExplorerSchemaProps;
}>): ReactNode => {
  if (section.id === "files") {
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
  if (section.id === "database") {
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
  return <StubSectionBody section={section} />;
};

export const Explorer = ({
  rootPath,
  showJunk,
  onToggleJunk,
  onOpenFile,
  schema,
  focusSection = null,
  onFocusSectionHandled,
  focusedObjectName = null,
}: ExplorerProps) => {
  const [activeSectionId, setActiveSectionId] = useState<ExplorerSectionId>("files");
  const activeSection =
    EXPLORER_SECTIONS.find((section) => section.id === activeSectionId) ?? EXPLORER_SECTIONS[0];

  useEffect(() => {
    if (!focusSection) {
      return;
    }
    setActiveSectionId(focusSection);
    onFocusSectionHandled?.();
  }, [focusSection, onFocusSectionHandled]);

  return (
    <aside className="ide-pane ide-pane--left" aria-label="Explorer navigation">
      <div className="pane-header">
        <strong>Explorer</strong>
      </div>
      <nav className="explorer-section-nav" aria-label="Explorer sections">
        {EXPLORER_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={
              section.id === activeSection.id
                ? "explorer-section-button explorer-section-button--active"
                : "explorer-section-button"
            }
            aria-label={section.title}
            aria-pressed={section.id === activeSection.id}
            onClick={() => setActiveSectionId(section.id)}
          >
            <span aria-hidden="true">{section.title}</span>
            {section.stub ? <StubBadge /> : null}
          </button>
        ))}
      </nav>
      {focusedObjectName && activeSection.id === "database" ? (
        <p className="pane-muted explorer-focused-object" data-testid="explorer-focused-object">
          Focused object: {focusedObjectName}
        </p>
      ) : null}
      <div className="pane-body explorer-section-body" data-section={activeSection.id}>
        <SectionBody
          section={activeSection}
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
