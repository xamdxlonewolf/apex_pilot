import {
  type BackendConfig,
  type InteractivePoolStatus,
  type SchemaSummary,
} from "./backend";
import { SchemaBrowser, type SchemaOpenTarget } from "./SchemaBrowser";

export type DatabaseDrawerProps = Readonly<{
  backendConfig: BackendConfig;
  connectedConnection: string | null;
  interactiveStatus: InteractivePoolStatus;
  isBackendOnline: boolean;
  projectSchemaOverride: string | null;
  workingSchema: string;
  onWorkingSchemaChange: (schema: string, options?: { persist?: boolean }) => void;
  onActivityRefresh: () => Promise<void>;
  onSaveSummary?: (summary: SchemaSummary) => void;
  onSummaryChange?: (summary: SchemaSummary | null) => void;
  onOpenObject?: (target: SchemaOpenTarget) => void;
  focusedObjectName?: string | null;
}>;

/** Dedicated Database Drawer body — not an Explorer posture. */
export const DatabaseDrawer = ({
  backendConfig,
  connectedConnection,
  interactiveStatus,
  isBackendOnline,
  projectSchemaOverride,
  workingSchema,
  onWorkingSchemaChange,
  onActivityRefresh,
  onSaveSummary,
  onSummaryChange,
  onOpenObject,
  focusedObjectName = null,
}: DatabaseDrawerProps) => (
  <div className="database-drawer" aria-label="Database browser">
    {focusedObjectName ? (
      <p className="pane-muted explorer-focused-object" data-testid="database-focused-object">
        Focused object: {focusedObjectName}
      </p>
    ) : null}
    <SchemaBrowser
      backendConfig={backendConfig}
      connectedConnection={connectedConnection}
      interactiveStatus={interactiveStatus}
      isBackendOnline={isBackendOnline}
      projectSchemaOverride={projectSchemaOverride}
      workingSchema={workingSchema}
      onWorkingSchemaChange={onWorkingSchemaChange}
      onActivityRefresh={onActivityRefresh}
      onSaveSummary={onSaveSummary}
      onSummaryChange={onSummaryChange}
      onOpenObject={onOpenObject}
    />
  </div>
);
