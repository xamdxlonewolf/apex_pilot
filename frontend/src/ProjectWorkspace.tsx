import { type FormEvent, useEffect, useState } from "react";

import {
  type BackendConfig,
  type LocalProfile,
  type OpenedProject,
  type PreflightReport,
  type ProjectSummary,
  type SavedConnection,
  BackendApiError,
  closeCurrentProject,
  createProfile,
  createProject,
  getPreflight,
  importProject,
  listProfiles,
  listProjects,
  openProject,
  setApexWorkspaceMapping,
  setEnvironmentMapping,
} from "./backend";

type WizardMode = "home" | "new" | "open" | "clone" | "settings";

type ProjectWorkspaceProps = Readonly<{
  backendConfig: BackendConfig;
  isBackendOnline: boolean;
  connections: SavedConnection[];
  openedProject: OpenedProject | null;
  onOpenedProjectChange: (project: OpenedProject | null) => void;
}>;

const retentionOptions = [
  { label: "90 days", days: 90, indefinite: false },
  { label: "365 days", days: 365, indefinite: false },
  { label: "Indefinite", days: null, indefinite: true },
] as const;

export const ProjectWorkspace = ({
  backendConfig,
  isBackendOnline,
  connections,
  openedProject,
  onOpenedProjectChange,
}: ProjectWorkspaceProps) => {
  const [mode, setMode] = useState<WizardMode>("home");
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [message, setMessage] = useState("Create or open a project before agent work.");
  const [busy, setBusy] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");

  const [projectName, setProjectName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [description, setDescription] = useState("");
  const [retentionDays, setRetentionDays] = useState<number | null>(365);
  const [retentionIndefinite, setRetentionIndefinite] = useState(false);
  const [initGit, setInitGit] = useState(false);
  const [apexWorkspaceHint, setApexWorkspaceHint] = useState("");
  const [apexAppId, setApexAppId] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [cloneParent, setCloneParent] = useState("");
  const [envConnectionDrafts, setEnvConnectionDrafts] = useState<Record<string, string>>({});
  const [apexWorkspaceDraft, setApexWorkspaceDraft] = useState("");
  const [apexConnectionDraft, setApexConnectionDraft] = useState("");

  const refreshProjectState = async () => {
    if (!isBackendOnline) {
      return;
    }
    const [preflightReport, profilePayload, projectPayload] = await Promise.all([
      getPreflight({
        projectRoot: openedProject?.project.root_path,
        config: backendConfig,
      }),
      listProfiles(backendConfig),
      listProjects({ config: backendConfig, limit: 8 }),
    ]);
    setPreflight(preflightReport);
    setProfiles(profilePayload.profiles);
    setRecentProjects(projectPayload.projects);
    setSelectedProfileId((current) => current || profilePayload.profiles[0]?.profile_id || "");
  };

  useEffect(() => {
    if (!isBackendOnline) {
      return;
    }
    void refreshProjectState().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Could not load project state.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when backend/project identity changes
  }, [backendConfig, isBackendOnline, openedProject?.project.project_id]);

  useEffect(() => {
    if (!openedProject) {
      return;
    }
    const drafts: Record<string, string> = {};
    for (const mapping of openedProject.environment_mappings) {
      drafts[mapping.environment_name] = mapping.sqlcl_connection_name;
    }
    for (const envName of openedProject.unmapped_environments) {
      drafts[envName] = drafts[envName] ?? "";
    }
    setEnvConnectionDrafts(drafts);
  }, [openedProject]);

  const ensureProfile = async (): Promise<string> => {
    if (selectedProfileId) {
      return selectedProfileId;
    }
    if (!displayName.trim()) {
      throw new BackendApiError("Create a local profile before continuing.");
    }
    const profile = await createProfile(
      {
        display_name: displayName.trim(),
        email: email.trim() || null,
        username: username.trim() || null,
      },
      backendConfig,
    );
    setProfiles((current) => [...current, profile]);
    setSelectedProfileId(profile.profile_id);
    return profile.profile_id;
  };

  const handleCreateProfile = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const profile = await createProfile(
        {
          display_name: displayName.trim(),
          email: email.trim() || null,
          username: username.trim() || null,
        },
        backendConfig,
      );
      setProfiles((current) => [...current, profile]);
      setSelectedProfileId(profile.profile_id);
      setMessage(`Profile ${profile.display_name} ready.`);
      setMode("home");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create profile.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateProject = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const profileId = await ensureProfile();
      const opened = await createProject(
        {
          profile_id: profileId,
          name: projectName.trim(),
          root_path: rootPath.trim(),
          description: description.trim() || null,
          retention_days: retentionIndefinite ? null : retentionDays,
          retention_indefinite: retentionIndefinite,
          init_git: initGit,
          apex_workspace_hint: apexWorkspaceHint.trim() || null,
          apex_app_id: apexAppId.trim() ? Number(apexAppId) : null,
        },
        backendConfig,
      );
      onOpenedProjectChange(opened);
      setMessage(`Opened project ${opened.project.name}.`);
      setMode("home");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setBusy(false);
    }
  };

  const handleImportPath = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const profileId = await ensureProfile();
      const opened = await importProject(
        {
          profile_id: profileId,
          root_path: rootPath.trim(),
          retention_days: retentionIndefinite ? null : retentionDays,
          retention_indefinite: retentionIndefinite,
        },
        backendConfig,
      );
      onOpenedProjectChange(opened);
      setMessage(`Opened project ${opened.project.name}.`);
      setMode("home");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open project path.");
    } finally {
      setBusy(false);
    }
  };

  const handleClone = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const profileId = await ensureProfile();
      const opened = await importProject(
        {
          profile_id: profileId,
          remote_url: remoteUrl.trim(),
          clone_parent: cloneParent.trim(),
          retention_days: retentionIndefinite ? null : retentionDays,
          retention_indefinite: retentionIndefinite,
        },
        backendConfig,
      );
      onOpenedProjectChange(opened);
      setMessage(`Cloned and opened ${opened.project.name}.`);
      setMode("home");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not clone remote project.");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenRecent = async (projectId: string) => {
    setBusy(true);
    try {
      const opened = await openProject(projectId, backendConfig);
      onOpenedProjectChange(opened);
      setMessage(`Opened project ${opened.project.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open recent project.");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    setBusy(true);
    try {
      await closeCurrentProject(backendConfig);
      onOpenedProjectChange(null);
      setMessage("Project closed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not close project.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEnvironmentMapping = async (environmentName: string) => {
    if (!openedProject) {
      return;
    }
    const connectionName = envConnectionDrafts[environmentName]?.trim();
    if (!connectionName) {
      setMessage("Choose a SQLcl saved connection for the environment.");
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
      const refreshed = await openProject(openedProject.project.project_id, backendConfig);
      onOpenedProjectChange(refreshed);
      setMessage(`Mapped ${environmentName} to ${connectionName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save environment mapping.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveApexMapping = async (event: FormEvent) => {
    event.preventDefault();
    if (!openedProject) {
      return;
    }
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
      setMessage(error instanceof Error ? error.message : "Could not save APEX workspace mapping.");
    } finally {
      setBusy(false);
    }
  };

  const environmentNames = openedProject
    ? [
        ...new Set([
          ...openedProject.environment_mappings.map((item) => item.environment_name),
          ...openedProject.unmapped_environments,
        ]),
      ].sort()
    : [];

  return (
    <section className="project-workspace" aria-label="Project workspace">
      <div className="project-menubar" role="toolbar" aria-label="Project menu">
        <button type="button" onClick={() => setMode("new")} disabled={!isBackendOnline || busy}>
          New Project
        </button>
        <button type="button" onClick={() => setMode("open")} disabled={!isBackendOnline || busy}>
          Open Project
        </button>
        <button type="button" onClick={() => setMode("clone")} disabled={!isBackendOnline || busy}>
          Clone Remote
        </button>
        <button
          type="button"
          onClick={() => {
            if (recentProjects[0]) {
              void handleOpenRecent(recentProjects[0].project_id);
              return;
            }
            setMode("open");
          }}
          disabled={!isBackendOnline || busy}
        >
          Open Recent
        </button>
        <button type="button" onClick={() => void handleClose()} disabled={!openedProject || busy}>
          Close Project
        </button>
        <button type="button" onClick={() => setMode("settings")} disabled={!isBackendOnline || busy}>
          Settings
        </button>
      </div>

      <article className="status-card">
        <div>
          <p className="card-label">Active Project</p>
          <h2>{openedProject ? openedProject.project.name : "No project open"}</h2>
        </div>
        <p>{message}</p>
        {openedProject ? (
          <dl>
            <div>
              <dt>Path</dt>
              <dd>{openedProject.project.root_path}</dd>
            </div>
            <div>
              <dt>Retention</dt>
              <dd>
                {openedProject.project.retention_days == null
                  ? "Indefinite"
                  : `${openedProject.project.retention_days} days`}
              </dd>
            </div>
            <div>
              <dt>Unmapped environments</dt>
              <dd>
                {openedProject.unmapped_environments.length > 0
                  ? openedProject.unmapped_environments.join(", ")
                  : "None"}
              </dd>
            </div>
          </dl>
        ) : null}
      </article>

      <article className="status-card">
        <div>
          <p className="card-label">Prerequisite Status</p>
          <h2>{preflight?.ready ? "Ready" : "Action needed"}</h2>
        </div>
        <p>
          Guided checks for Git, SQLcl, Java, Python, MCP smoke, and manifest load. Apex Pilot does
          not auto-install missing tools.
        </p>
        {preflight ? (
          <ul className="preflight-list" aria-label="Preflight checks">
            {preflight.checks.map((check) => (
              <li key={check.id} className={`preflight-item preflight-item--${check.status}`}>
                <div>
                  <strong>
                    {check.label}: {check.status}
                  </strong>
                  <p>{check.detail}</p>
                </div>
                {check.guide ? (
                  <details>
                    <summary>{check.guide.title}</summary>
                    <p>{check.guide.summary}</p>
                    <ol>
                      {check.guide.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    {check.guide.docs_url ? (
                      <p>
                        <a href={check.guide.docs_url} target="_blank" rel="noreferrer">
                          Documentation
                        </a>
                      </p>
                    ) : null}
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>Waiting for backend preflight.</p>
        )}
      </article>

      {mode === "settings" || profiles.length === 0 ? (
        <article className="status-card">
          <div>
            <p className="card-label">Local Profile</p>
            <h2>Settings</h2>
          </div>
          <form className="stack-form" onSubmit={(event) => void handleCreateProfile(event)}>
            <label>
              Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
            </label>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label>
              Active profile
              <select
                value={selectedProfileId}
                onChange={(event) => setSelectedProfileId(event.target.value)}
              >
                <option value="">Select a profile</option>
                {profiles.map((profile) => (
                  <option key={profile.profile_id} value={profile.profile_id}>
                    {profile.display_name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={busy || !displayName.trim()}>
              Create profile
            </button>
          </form>
        </article>
      ) : null}

      {mode === "new" ? (
        <article className="status-card">
          <div>
            <p className="card-label">Wizard</p>
            <h2>New Project</h2>
          </div>
          <form className="stack-form" onSubmit={(event) => void handleCreateProject(event)}>
            <label>
              Project name
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} required />
            </label>
            <label>
              Folder path
              <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} required />
            </label>
            <label>
              Description
              <input value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label>
              Retention
              <select
                value={retentionIndefinite ? "indefinite" : String(retentionDays)}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "indefinite") {
                    setRetentionIndefinite(true);
                    setRetentionDays(null);
                    return;
                  }
                  setRetentionIndefinite(false);
                  setRetentionDays(Number(value));
                }}
              >
                {retentionOptions.map((option) => (
                  <option
                    key={option.label}
                    value={option.indefinite ? "indefinite" : String(option.days)}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={initGit}
                onChange={(event) => setInitGit(event.target.checked)}
              />
              Initialize Git repository
            </label>
            <label>
              Optional APEX workspace hint
              <input
                value={apexWorkspaceHint}
                onChange={(event) => setApexWorkspaceHint(event.target.value)}
              />
            </label>
            <label>
              Optional APEX app id
              <input value={apexAppId} onChange={(event) => setApexAppId(event.target.value)} />
            </label>
            <div className="button-row">
              <button type="submit" disabled={busy}>
                Create project
              </button>
              <button type="button" className="button-secondary" onClick={() => setMode("home")}>
                Cancel
              </button>
            </div>
          </form>
        </article>
      ) : null}

      {mode === "open" ? (
        <article className="status-card">
          <div>
            <p className="card-label">Wizard</p>
            <h2>Open Project</h2>
          </div>
          <form className="stack-form" onSubmit={(event) => void handleImportPath(event)}>
            <label>
              Existing folder with apex-pilot.json
              <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} required />
            </label>
            <label>
              Retention
              <select
                value={retentionIndefinite ? "indefinite" : String(retentionDays)}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "indefinite") {
                    setRetentionIndefinite(true);
                    setRetentionDays(null);
                    return;
                  }
                  setRetentionIndefinite(false);
                  setRetentionDays(Number(value));
                }}
              >
                {retentionOptions.map((option) => (
                  <option
                    key={option.label}
                    value={option.indefinite ? "indefinite" : String(option.days)}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button type="submit" disabled={busy}>
                Open folder
              </button>
              <button type="button" className="button-secondary" onClick={() => setMode("home")}>
                Cancel
              </button>
            </div>
          </form>
          {recentProjects.length > 0 ? (
            <ul className="recent-project-list" aria-label="Recent projects">
              {recentProjects.map((project) => (
                <li key={project.project_id}>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={busy}
                    onClick={() => void handleOpenRecent(project.project_id)}
                  >
                    {project.name}
                  </button>
                  <span>{project.root_path}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ) : null}

      {mode === "clone" ? (
        <article className="status-card">
          <div>
            <p className="card-label">Wizard</p>
            <h2>Clone Remote</h2>
          </div>
          <p>
            Uses installed Git only. Apex Pilot does not store Git credentials; rely on OS helpers or
            SSH agent.
          </p>
          <form className="stack-form" onSubmit={(event) => void handleClone(event)}>
            <label>
              Remote URL (HTTPS or SSH)
              <input value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} required />
            </label>
            <label>
              Clone into parent folder
              <input
                value={cloneParent}
                onChange={(event) => setCloneParent(event.target.value)}
                required
              />
            </label>
            <div className="button-row">
              <button type="submit" disabled={busy}>
                Clone and open
              </button>
              <button type="button" className="button-secondary" onClick={() => setMode("home")}>
                Cancel
              </button>
            </div>
          </form>
        </article>
      ) : null}

      {openedProject ? (
        <article className="status-card">
          <div>
            <p className="card-label">Local Mappings</p>
            <h2>Environments and APEX</h2>
          </div>
          <p>
            Logical environments stay in apex-pilot.json. SQLcl saved connection names stay local.
          </p>
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
                  onClick={() => void handleSaveEnvironmentMapping(environmentName)}
                >
                  Save mapping
                </button>
              </li>
            ))}
          </ul>
          <form className="stack-form" onSubmit={(event) => void handleSaveApexMapping(event)}>
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
        </article>
      ) : null}
    </section>
  );
};
