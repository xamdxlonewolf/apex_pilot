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
import { pickDirectory } from "./projectFs";
import { AppSettings } from "./AppSettings";

export type FunnelPhase = "booting" | "preflight" | "profile" | "picker" | "wizard";

export type WizardMode = "new" | "open" | "clone" | "settings";

type StartupFunnelProps = Readonly<{
  backendConfig: BackendConfig;
  isBackendOnline: boolean;
  connections: SavedConnection[];
  openedProject: OpenedProject | null;
  onOpenedProjectChange: (project: OpenedProject | null) => void;
  onPhaseChange?: (phase: FunnelPhase | "workspace") => void;
  onProfilesChange?: (profiles: LocalProfile[], selectedProfileId: string) => void;
  wizardMode: WizardMode | null;
  onWizardModeChange: (mode: WizardMode | null) => void;
  requestClose?: boolean;
  onCloseHandled?: () => void;
  hasUnsavedWork?: boolean;
}>;

const retentionOptions = [
  { label: "90 days", days: 90, indefinite: false },
  { label: "365 days", days: 365, indefinite: false },
  { label: "Indefinite", days: null, indefinite: true },
] as const;

const FIRST_LAUNCH_KEY = "apex-pilot.first-launch-complete";

export const StartupFunnel = ({
  backendConfig,
  isBackendOnline,
  connections: _connections,
  openedProject,
  onOpenedProjectChange,
  onPhaseChange,
  onProfilesChange,
  wizardMode,
  onWizardModeChange,
  requestClose = false,
  onCloseHandled,
  hasUnsavedWork = false,
}: StartupFunnelProps) => {
  void _connections;
  const [phase, setPhase] = useState<FunnelPhase>("booting");
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [message, setMessage] = useState("");
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

  const goPhase = (next: FunnelPhase | "workspace") => {
    if (next !== "workspace") {
      setPhase(next);
    }
    onPhaseChange?.(next);
  };

  const refreshBootstrap = async () => {
    const [preflightReport, profilePayload, projectPayload] = await Promise.all([
      getPreflight({
        projectRoot: openedProject?.project.root_path,
        config: backendConfig,
      }),
      listProfiles(backendConfig),
      listProjects({ config: backendConfig, limit: 12 }),
    ]);
    setPreflight(preflightReport);
    setProfiles(profilePayload.profiles);
    setRecentProjects(projectPayload.projects);
    const nextProfileId = selectedProfileId || profilePayload.profiles[0]?.profile_id || "";
    setSelectedProfileId(nextProfileId);
    onProfilesChange?.(profilePayload.profiles, nextProfileId);
    return { preflightReport, profilePayload };
  };

  useEffect(() => {
    if (!isBackendOnline) {
      goPhase("booting");
      return;
    }
    if (openedProject && !wizardMode) {
      goPhase("workspace");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { preflightReport, profilePayload } = await refreshBootstrap();
        if (cancelled) {
          return;
        }
        const firstLaunchDone = localStorage.getItem(FIRST_LAUNCH_KEY) === "1";
        if (!preflightReport.ready || !firstLaunchDone) {
          goPhase("preflight");
          return;
        }
        if (profilePayload.profiles.length === 0) {
          goPhase("profile");
          return;
        }
        if (wizardMode) {
          goPhase("wizard");
          return;
        }
        goPhase("picker");
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Could not load startup state.");
          goPhase("preflight");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendConfig, isBackendOnline, openedProject?.project.project_id, wizardMode]);

  useEffect(() => {
    if (!requestClose) {
      return;
    }
    void (async () => {
      if (hasUnsavedWork) {
        const proceed = window.confirm("You have unsaved work. Close the project anyway?");
        if (!proceed) {
          onCloseHandled?.();
          return;
        }
      }
      setBusy(true);
      try {
        await closeCurrentProject(backendConfig);
        onOpenedProjectChange(null);
        setMessage("Project closed.");
        onWizardModeChange(null);
        goPhase("picker");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not close project.");
      } finally {
        setBusy(false);
        onCloseHandled?.();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestClose]);

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
    onProfilesChange?.([...profiles, profile], profile.profile_id);
    return profile.profile_id;
  };

  const continueAfterPreflight = () => {
    localStorage.setItem(FIRST_LAUNCH_KEY, "1");
    if (profiles.length === 0) {
      goPhase("profile");
      return;
    }
    goPhase("picker");
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
      const nextProfiles = [...profiles, profile];
      setProfiles(nextProfiles);
      setSelectedProfileId(profile.profile_id);
      onProfilesChange?.(nextProfiles, profile.profile_id);
      setMessage(`Profile ${profile.display_name} ready.`);
      onWizardModeChange(null);
      goPhase(openedProject ? "workspace" : "picker");
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
      onWizardModeChange(null);
      goPhase("workspace");
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
      onWizardModeChange(null);
      goPhase("workspace");
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
      onWizardModeChange(null);
      goPhase("workspace");
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
      goPhase("workspace");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open recent project.");
    } finally {
      setBusy(false);
    }
  };

  const pickRoot = async (setter: (value: string) => void) => {
    const selected = await pickDirectory();
    if (selected) {
      setter(selected);
    }
  };

  if (openedProject && !wizardMode) {
    return null;
  }

  if (!isBackendOnline && !wizardMode) {
    return (
      <div className="funnel-screen" aria-label="Starting">
        <h1>Apex Pilot</h1>
        <p className="pane-muted">
          Waiting for the local backend. In development, start FastAPI and set the loopback URL and
          bearer token; packaged mode uses the Tauri sidecar handshake.
        </p>
      </div>
    );
  }

  if (phase === "booting" && !wizardMode) {
    return (
      <div className="funnel-screen" aria-label="Starting">
        <p className="pane-muted">Checking backend health…</p>
      </div>
    );
  }

  if (phase === "preflight" && !wizardMode) {
    const ready = Boolean(preflight?.ready);
    return (
      <div className="funnel-screen" aria-label="Preflight">
        <h1>Prerequisite check</h1>
        <p>
          Apex Pilot checks Git, SQLcl, Java, Python, MCP smoke, and manifest load before project
          work. Project menu actions stay disabled until you finish this step.
        </p>
        <div className={`funnel-callout${ready ? " funnel-callout--ready" : ""}`} role="status">
          {ready ? (
            <p>
              All required checks passed. Click <strong>Continue to profile setup</strong> below to
              proceed.
            </p>
          ) : (
            <p>
              Fix any missing or failed checks below, then click <strong>Re-check</strong>. Continue
              unlocks when prerequisites are ready.
            </p>
          )}
        </div>
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
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>Loading preflight…</p>
        )}
        <div className="funnel-actions">
          <button type="button" disabled={!ready} onClick={continueAfterPreflight}>
            Continue to profile setup
          </button>
          <button type="button" className="chrome-button" onClick={() => void refreshBootstrap()}>
            Re-check
          </button>
        </div>
        {!ready ? (
          <p className="pane-muted">Continue stays disabled until every blocking check is ready.</p>
        ) : null}
        {message ? <p className="pane-muted">{message}</p> : null}
      </div>
    );
  }

  if (wizardMode === "settings") {
    return (
      <AppSettings
        backendConfig={backendConfig}
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        onProfilesChange={(nextProfiles, nextSelected) => {
          setProfiles(nextProfiles);
          setSelectedProfileId(nextSelected);
          onProfilesChange?.(nextProfiles, nextSelected);
        }}
        onClose={() => {
          onWizardModeChange(null);
          goPhase(openedProject ? "workspace" : "picker");
        }}
      />
    );
  }

  if (phase === "profile") {
    return (
      <div className="funnel-screen" aria-label="Profile setup">
        <h1>Create a local profile</h1>
        <div className="funnel-callout funnel-callout--ready" role="status">
          <p>
            Project menus stay disabled until you create or select a profile. This identifies your
            local workspace preferences.
          </p>
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
          {profiles.length > 0 ? (
            <label>
              Active profile
              <select
                value={selectedProfileId}
                onChange={(event) => {
                  setSelectedProfileId(event.target.value);
                  onProfilesChange?.(profiles, event.target.value);
                }}
              >
                {profiles.map((profile) => (
                  <option key={profile.profile_id} value={profile.profile_id}>
                    {profile.display_name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="button-row">
            <button type="submit" disabled={busy || !displayName.trim()}>
              Create profile
            </button>
            {profiles.length > 0 ? (
              <button
                type="button"
                className="chrome-button"
                onClick={() => {
                  onWizardModeChange(null);
                  goPhase(openedProject ? "workspace" : "picker");
                }}
              >
                Done
              </button>
            ) : null}
          </div>
        </form>
        {message ? <p className="pane-muted">{message}</p> : null}
      </div>
    );
  }

  if (wizardMode === "new") {
    return (
      <div className="funnel-screen" aria-label="New project">
        <h1>New project</h1>
        <form className="stack-form" onSubmit={(event) => void handleCreateProject(event)}>
          <label>
            Project name
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} required />
          </label>
          <label>
            Folder path
            <div className="path-row">
              <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} required />
              <button type="button" className="chrome-button" onClick={() => void pickRoot(setRootPath)}>
                Browse…
              </button>
            </div>
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
            <input type="checkbox" checked={initGit} onChange={(event) => setInitGit(event.target.checked)} />
            Initialize Git repository
          </label>
          <label>
            Optional APEX workspace hint
            <input value={apexWorkspaceHint} onChange={(event) => setApexWorkspaceHint(event.target.value)} />
          </label>
          <label>
            Optional APEX app id
            <input value={apexAppId} onChange={(event) => setApexAppId(event.target.value)} />
          </label>
          <div className="button-row">
            <button type="submit" disabled={busy}>
              Create project
            </button>
            <button type="button" className="chrome-button" onClick={() => onWizardModeChange(null)}>
              Cancel
            </button>
          </div>
        </form>
        {message ? <p className="pane-muted">{message}</p> : null}
      </div>
    );
  }

  if (wizardMode === "open") {
    return (
      <div className="funnel-screen" aria-label="Open project">
        <h1>Open project</h1>
        <form className="stack-form" onSubmit={(event) => void handleImportPath(event)}>
          <label>
            Existing folder with apex-pilot.json
            <div className="path-row">
              <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} required />
              <button type="button" className="chrome-button" onClick={() => void pickRoot(setRootPath)}>
                Browse…
              </button>
            </div>
          </label>
          <div className="button-row">
            <button type="submit" disabled={busy}>
              Open folder
            </button>
            <button type="button" className="chrome-button" onClick={() => onWizardModeChange(null)}>
              Cancel
            </button>
          </div>
        </form>
        {message ? <p className="pane-muted">{message}</p> : null}
      </div>
    );
  }

  if (wizardMode === "clone") {
    return (
      <div className="funnel-screen" aria-label="Clone remote">
        <h1>Clone remote</h1>
        <p>Uses installed Git only. Credentials stay with OS helpers / SSH agent.</p>
        <form className="stack-form" onSubmit={(event) => void handleClone(event)}>
          <label>
            Remote URL
            <input value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} required />
          </label>
          <label>
            Clone into parent folder
            <div className="path-row">
              <input value={cloneParent} onChange={(event) => setCloneParent(event.target.value)} required />
              <button type="button" className="chrome-button" onClick={() => void pickRoot(setCloneParent)}>
                Browse…
              </button>
            </div>
          </label>
          <div className="button-row">
            <button type="submit" disabled={busy}>
              Clone and open
            </button>
            <button type="button" className="chrome-button" onClick={() => onWizardModeChange(null)}>
              Cancel
            </button>
          </div>
        </form>
        {message ? <p className="pane-muted">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="funnel-screen" aria-label="Recent projects">
      <h1>Apex Pilot</h1>
      <p>Open a recent project or start a new one.</p>
      <div className="button-row" role="toolbar" aria-label="Project menu">
        <button type="button" onClick={() => onWizardModeChange("new")} disabled={!isBackendOnline || busy}>
          New Project
        </button>
        <button type="button" onClick={() => onWizardModeChange("open")} disabled={!isBackendOnline || busy}>
          Open Project
        </button>
        <button type="button" onClick={() => onWizardModeChange("clone")} disabled={!isBackendOnline || busy}>
          Clone Remote
        </button>
      </div>
      <p className="pane-muted">
        Use <strong>Project → Settings</strong> in the top menu for profile and app preferences.
      </p>
      {recentProjects.length > 0 ? (
        <ul className="recent-project-list" aria-label="Recent projects">
          {recentProjects.map((project) => (
            <li key={project.project_id}>
              <button
                type="button"
                className="chrome-button"
                disabled={busy}
                onClick={() => void handleOpenRecent(project.project_id)}
              >
                {project.name}
              </button>
              <span>{project.root_path}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pane-muted">No recent projects yet.</p>
      )}
      {message ? <p className="pane-muted">{message}</p> : null}
    </div>
  );
};

export const ProjectMappings = ({
  backendConfig,
  connections,
  openedProject,
  onOpenedProjectChange,
}: Readonly<{
  backendConfig: BackendConfig;
  connections: SavedConnection[];
  openedProject: OpenedProject;
  onOpenedProjectChange: (project: OpenedProject | null) => void;
}>) => {
  const [envConnectionDrafts, setEnvConnectionDrafts] = useState<Record<string, string>>({});
  const [apexWorkspaceDraft, setApexWorkspaceDraft] = useState("");
  const [apexConnectionDraft, setApexConnectionDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const drafts: Record<string, string> = {};
    for (const mapping of openedProject.environment_mappings) {
      drafts[mapping.environment_name] = mapping.sqlcl_connection_name;
    }
    for (const envName of openedProject.unmapped_environments) {
      drafts[envName] = drafts[envName] ?? "";
    }
    setEnvConnectionDrafts(drafts);
  }, [openedProject]);

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
