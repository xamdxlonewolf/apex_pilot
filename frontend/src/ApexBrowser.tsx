import { StubSurface } from "./StubSurface";
import { stubActionProps } from "./stubConvention";

export type ApexWorkspaceMappingItem = Readonly<{
  sqlcl_connection_name: string;
  workspace_name: string;
}>;

export type ApexOpenTarget = Readonly<{
  workspaceName: string;
  connectionName: string;
}>;

type ApexBrowserProps = Readonly<{
  mappings: ReadonlyArray<ApexWorkspaceMappingItem>;
  onOpenApex: (target: ApexOpenTarget) => void;
}>;

/**
 * APEX Explorer posture: browse project-mapped APEX workspaces (real mappings only).
 * App/page metadata browsing stays Stub until APEX metadata integration lands.
 */
export const ApexBrowser = ({ mappings, onOpenApex }: ApexBrowserProps) => {
  if (mappings.length === 0) {
    return (
      <div className="explorer-apex" aria-label="APEX browser">
        <StubSurface
          title="APEX"
          secondary="Map an APEX workspace in Project mappings to browse it here. Application and page catalogs arrive with APEX metadata integration."
          bodyClassName="explorer-stub-body"
          actions={
            <div className="explorer-stub-actions">
              <button type="button" className="chrome-button" {...stubActionProps()}>
                Refresh
              </button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="explorer-apex" aria-label="APEX browser">
      <p className="pane-muted">
        Project-mapped APEX workspaces. Open a workspace to view it in the Workspace (page
        catalog remains Stub until metadata integration).
      </p>
      <ul className="object-browse-list" aria-label="APEX workspaces">
        {mappings.map((mapping) => (
          <li key={`${mapping.sqlcl_connection_name}:${mapping.workspace_name}`}>
            <button
              type="button"
              className="object-browse-button"
              onClick={() =>
                onOpenApex({
                  workspaceName: mapping.workspace_name,
                  connectionName: mapping.sqlcl_connection_name,
                })
              }
            >
              <span className="object-browse-name">{mapping.workspace_name}</span>
              <span className="object-browse-meta">{mapping.sqlcl_connection_name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
