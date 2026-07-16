import { useState } from "react";

import {
  type BackendConfig,
  type OpenedProject,
  type SavedConnection,
  openProject,
  setApexWorkspaceMapping,
  setEnvironmentMapping,
} from "./backend";

type ProjectMappingsProps = Readonly<{
  backendConfig: BackendConfig;
  connections: SavedConnection[];
  openedProject: OpenedProject;
  onOpenedProjectChange: (project: OpenedProject | null) => void;
}>;

const environmentConnectionDrafts = (openedProject: OpenedProject): Record<string, string> => {
  const drafts: Record<string, string> = {};
  for (const mapping of openedProject.environment_mappings) {
    drafts[mapping.environment_name] = mapping.sqlcl_connection_name;
  }
  for (const envName of openedProject.unmapped_environments) {
    drafts[envName] = drafts[envName] ?? "";
  }
  return drafts;
};

/** Env → SQLcl / APEX workspace mappings for the open project (preferences UX). */
export const ProjectMappings = ({
  backendConfig,
  connections,
  openedProject,
  onOpenedProjectChange,
}: ProjectMappingsProps) => {
  const [draftSource, setDraftSource] = useState(openedProject);
  const [envConnectionDrafts, setEnvConnectionDrafts] = useState<Record<string, string>>(() =>
    environmentConnectionDrafts(openedProject),
  );
  const [apexWorkspaceDraft, setApexWorkspaceDraft] = useState("");
  const [apexConnectionDraft, setApexConnectionDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (openedProject !== draftSource) {
    setDraftSource(openedProject);
    setEnvConnectionDrafts(environmentConnectionDrafts(openedProject));
  }

  const environmentNames = [
    ...new Set([
      ...openedProject.environment_mappings.map((item) => item.environment_name),
      ...openedProject.unmapped_environments,
    ]),
  ].sort();

  return (
    <div className="tool-panel" aria-label="Project mappings">
      <p className="pane-muted">
        Logical environments stay in apex-pilot.json. SQLcl connection names stay local.
      </p>
      {connections.length === 0 ? (
        <p className="pane-muted" role="status">
          No SQLcl saved connections were returned. Create or import them in SQLcl, then refresh —
          Apex Pilot does not invent connection names.
        </p>
      ) : null}
      {environmentNames.length === 0 ? (
        <p className="pane-muted" role="status">
          No environments to map yet. Add environments in apex-pilot.json for this project.
        </p>
      ) : null}
      <ul className="mapping-list" aria-label="Environment mappings">
        {environmentNames.map((environmentName) => (
          <li key={environmentName}>
            <strong>{environmentName}</strong>
            <select
              value={envConnectionDrafts[environmentName] ?? ""}
              onChange={(event) =>
                setEnvConnectionDrafts((current) => ({
                  ...current,
                  [environmentName]: event.target.value,
                }))
              }
            >
              <option value="">Select SQLcl connection</option>
              {connections.map((connection) => (
                <option key={connection.name} value={connection.name}>
                  {connection.display_name
                    ? `${connection.display_name} (${connection.name})`
                    : connection.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  const connectionName = envConnectionDrafts[environmentName]?.trim();
                  if (!connectionName) {
                    setMessage("Choose a SQLcl saved connection.");
                    return;
                  }
                  setBusy(true);
                  try {
                    await setEnvironmentMapping(
                      openedProject.project.project_id,
                      {
                        environment_name: environmentName,
                        sqlcl_connection_name: connectionName,
                      },
                      backendConfig,
                    );
                    const refreshed = await openProject(
                      openedProject.project.project_id,
                      backendConfig,
                    );
                    onOpenedProjectChange(refreshed);
                    setMessage(`Mapped ${environmentName} to ${connectionName}.`);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Could not save mapping.");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Save mapping
            </button>
          </li>
        ))}
      </ul>
      <form
        className="stack-form"
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            setBusy(true);
            try {
              await setApexWorkspaceMapping(
                openedProject.project.project_id,
                {
                  sqlcl_connection_name: apexConnectionDraft.trim(),
                  workspace_name: apexWorkspaceDraft.trim(),
                },
                backendConfig,
              );
              const refreshed = await openProject(openedProject.project.project_id, backendConfig);
              onOpenedProjectChange(refreshed);
              setMessage("Saved APEX workspace mapping.");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Could not save APEX mapping.");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <label>
          SQLcl connection for APEX workspace
          <select
            value={apexConnectionDraft}
            onChange={(event) => setApexConnectionDraft(event.target.value)}
            required
          >
            <option value="">Select connection</option>
            {connections.map((connection) => (
              <option key={connection.name} value={connection.name}>
                {connection.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          APEX workspace name
          <input
            value={apexWorkspaceDraft}
            onChange={(event) => setApexWorkspaceDraft(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          Save APEX mapping
        </button>
      </form>
      {message ? <p className="pane-muted">{message}</p> : null}
    </div>
  );
};
