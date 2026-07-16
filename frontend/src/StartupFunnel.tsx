import { type FormEvent, useEffect, useState } from "react";

import {
  type BackendConfig,
  type LocalProfile,
  type OpenedProject,
  type PreflightReport,
  type ProjectSummary,
  type SavedConnection,
  BackendApiError,
  createProfile,
  createProject,
  getPreflight,
  importProject,
  listProfiles,
  listProjects,
  openProject,
} from "./backend";
import { AppSettings } from "./AppSettings";
import { ConnectionWizard } from "./ConnectionWizard";
import { DialogChrome } from "./DialogChrome";
import { pickDirectory } from "./projectFs";
import { StubBadge, StubMessage } from "./StubSurface";
import { WizardChrome } from "./WizardChrome";

export { ProjectMappings } from "./ProjectMappings";

export type FunnelPhase = "booting" | "preflight" | "profile" | "picker" | "wizard";

export type WizardMode = "new" | "open" | "clone" | "settings" | "connection";

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
}>;

const retentionOptions = [
  { label: "90 days", days: 90, indefinite: false },
  { label: "365 days", days: 365, indefinite: false },
  { label: "Indefinite", days: null, indefinite: true },
] as const;

const PROJECT_WIZARD_STEPS = [
  "Project Details",
  "Location",
  "Git",
  "Connection",
  "Summary",
] as const;

const FIRST_LAUNCH_KEY = "apex-pilot.first-launch-complete";

export const StartupFunnel = ({
  backendConfig,
  isBackendOnline,
  connections,
  openedProject,
  onOpenedProjectChange,
  onPhaseChange,
  onProfilesChange,
  wizardMode,
  onWizardModeChange,
}: StartupFunnelProps) => {
  const [phase, setPhase] = useState<FunnelPhase>("booting");
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [projectStepIndex, setProjectStepIndex] = useState(0);
  const [projectStepWizardMode, setProjectStepWizardMode] = useState(wizardMode);

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

  if (wizardMode !== projectStepWizardMode) {
    setProjectStepWizardMode(wizardMode);
    if (wizardMode === "new") {
      setProjectStepIndex(0);
    }
  }

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
      onPhaseChange?.("booting");
      return;
    }
    if (openedProject && !wizardMode) {
      onPhaseChange?.("workspace");
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

  const runCreateProject = async () => {
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

  const retentionSelect = (
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
          <option key={option.label} value={option.indefinite ? "indefinite" : String(option.days)}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const canAdvanceProjectStep = (): boolean => {
    if (projectStepIndex === 0) {
      return Boolean(projectName.trim());
    }
    if (projectStepIndex === 1) {
      return Boolean(rootPath.trim());
    }
    return true;
  };

  const canFinishProject =
    Boolean(projectName.trim()) && Boolean(rootPath.trim()) && !busy;

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

  const visiblePhase = !isBackendOnline && !wizardMode ? "booting" : phase;

  if (visiblePhase === "booting" && !wizardMode) {
    return (
      <div className="funnel-screen" aria-label="Starting">
        <p className="pane-muted">Checking backend health…</p>
      </div>
    );
  }

  if (visiblePhase === "preflight" && !wizardMode) {
    const ready = Boolean(preflight?.ready);
    return (
      <DialogChrome
        title="Prerequisite check"
        description="Apex Pilot checks Git, SQLcl, Java, Python, MCP smoke, and manifest load before project work. Project menu actions stay disabled until you finish this step."
        aria-label="Preflight"
        banner={
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
        }
        secondaryAction={
          <button type="button" className="chrome-button" onClick={() => void refreshBootstrap()}>
            Re-check
          </button>
        }
        primaryAction={
          <button type="button" disabled={!ready} onClick={continueAfterPreflight}>
            Continue to profile setup
          </button>
        }
      >
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
        {!ready ? (
          <p className="pane-muted">Continue stays disabled until every blocking check is ready.</p>
        ) : null}
        {message ? <p className="pane-muted">{message}</p> : null}
      </DialogChrome>
    );
  }

  if (wizardMode === "settings") {
    return (
      <AppSettings
        backendConfig={backendConfig}
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        connections={connections}
        openedProject={openedProject}
        onOpenedProjectChange={onOpenedProjectChange}
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

  if (wizardMode === "connection") {
    return <ConnectionWizard onCancel={() => onWizardModeChange(null)} />;
  }

  if (visiblePhase === "profile") {
    return (
      <DialogChrome
        title="Create a local profile"
        description="Project menus stay disabled until you create or select a profile. This identifies your local workspace preferences."
        aria-label="Profile setup"
        secondaryAction={
          profiles.length > 0 ? (
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
          ) : null
        }
        primaryAction={
          <button
            type="submit"
            form="profile-setup-form"
            disabled={busy || !displayName.trim()}
          >
            Create profile
          </button>
        }
      >
        <form
          id="profile-setup-form"
          className="stack-form"
          onSubmit={(event) => void handleCreateProfile(event)}
        >
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
        </form>
        {message ? <p className="pane-muted">{message}</p> : null}
      </DialogChrome>
    );
  }

  if (wizardMode === "new") {
    const step = PROJECT_WIZARD_STEPS[projectStepIndex] ?? PROJECT_WIZARD_STEPS[0];
    return (
      <WizardChrome
        title="New project"
        description="Create a local Apex Pilot project. Backend create/open/clone contracts stay unchanged."
        steps={PROJECT_WIZARD_STEPS}
        activeStepIndex={projectStepIndex}
        busy={busy}
        canFinish={canFinishProject}
        onCancel={() => onWizardModeChange(null)}
        onBack={() => setProjectStepIndex((current) => Math.max(0, current - 1))}
        onNext={() => {
          if (!canAdvanceProjectStep()) {
            setMessage(
              projectStepIndex === 0
                ? "Enter a project name to continue."
                : "Choose a folder path to continue.",
            );
            return;
          }
          setMessage("");
          setProjectStepIndex((current) =>
            Math.min(PROJECT_WIZARD_STEPS.length - 1, current + 1),
          );
        }}
        onFinish={() => void runCreateProject()}
      >
        <div className="wizard-step-panel" aria-label={step}>
          {projectStepIndex === 0 ? (
            <div className="stack-form">
              <label>
                Project name
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  required
                />
              </label>
              <label>
                Description
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              {retentionSelect}
            </div>
          ) : null}
          {projectStepIndex === 1 ? (
            <div className="stack-form">
              <label>
                Folder path
                <div className="path-row">
                  <input
                    value={rootPath}
                    onChange={(event) => setRootPath(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="chrome-button"
                    onClick={() => void pickRoot(setRootPath)}
                  >
                    Browse…
                  </button>
                </div>
              </label>
            </div>
          ) : null}
          {projectStepIndex === 2 ? (
            <div className="stack-form">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={initGit}
                  onChange={(event) => setInitGit(event.target.checked)}
                />
                Initialize Git repository
              </label>
              <p className="pane-muted">
                Remote clone stays on Clone Remote. Credentials stay with OS helpers / SSH agent.
              </p>
            </div>
          ) : null}
          {projectStepIndex === 3 ? (
            <div className="wizard-step-panel">
              <div className="pane-header">
                <strong>Connection (optional)</strong>
                <span className="stub-chrome-trailing">
                  <StubBadge />
                </span>
              </div>
              <StubMessage secondary="Environment → SQLcl mappings are configured after the project opens." />
              <p className="pane-muted">
                Optional APEX hints can be set on Summary. Existing SQLcl saved connections are
                selected from the Context Bar once connected.
              </p>
            </div>
          ) : null}
          {projectStepIndex === 4 ? (
            <div className="stack-form">
              <dl className="compact-dl wizard-summary">
                <div>
                  <dt>Name</dt>
                  <dd>{projectName.trim() || "—"}</dd>
                </div>
                <div>
                  <dt>Path</dt>
                  <dd>{rootPath.trim() || "—"}</dd>
                </div>
                <div>
                  <dt>Git</dt>
                  <dd>{initGit ? "Initialize" : "Skip"}</dd>
                </div>
                <div>
                  <dt>Retention</dt>
                  <dd>
                    {retentionIndefinite
                      ? "Indefinite"
                      : retentionDays
                        ? `${retentionDays} days`
                        : "—"}
                  </dd>
                </div>
              </dl>
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
            </div>
          ) : null}
          {message ? <p className="pane-muted">{message}</p> : null}
        </div>
      </WizardChrome>
    );
  }

  if (wizardMode === "open") {
    return (
      <DialogChrome
        title="Open project"
        description="Choose an existing folder that already has apex-pilot.json."
        aria-label="Open project"
        secondaryAction={
          <button type="button" className="chrome-button" onClick={() => onWizardModeChange(null)}>
            Cancel
          </button>
        }
        primaryAction={
          <button type="submit" form="open-project-form" disabled={busy || !rootPath.trim()}>
            Open folder
          </button>
        }
      >
        <form
          id="open-project-form"
          className="stack-form"
          onSubmit={(event) => void handleImportPath(event)}
        >
          <label>
            Existing folder with apex-pilot.json
            <div className="path-row">
              <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} required />
              <button type="button" className="chrome-button" onClick={() => void pickRoot(setRootPath)}>
                Browse…
              </button>
            </div>
          </label>
        </form>
        {message ? <p className="pane-muted">{message}</p> : null}
      </DialogChrome>
    );
  }

  if (wizardMode === "clone") {
    return (
      <DialogChrome
        title="Clone remote"
        description="Uses installed Git only. Credentials stay with OS helpers / SSH agent."
        aria-label="Clone remote"
        secondaryAction={
          <button type="button" className="chrome-button" onClick={() => onWizardModeChange(null)}>
            Cancel
          </button>
        }
        primaryAction={
          <button
            type="submit"
            form="clone-project-form"
            disabled={busy || !remoteUrl.trim() || !cloneParent.trim()}
          >
            Clone and open
          </button>
        }
      >
        <form
          id="clone-project-form"
          className="stack-form"
          onSubmit={(event) => void handleClone(event)}
        >
          <label>
            Remote URL
            <input value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} required />
          </label>
          <label>
            Clone into parent folder
            <div className="path-row">
              <input
                value={cloneParent}
                onChange={(event) => setCloneParent(event.target.value)}
                required
              />
              <button
                type="button"
                className="chrome-button"
                onClick={() => void pickRoot(setCloneParent)}
              >
                Browse…
              </button>
            </div>
          </label>
        </form>
        {message ? <p className="pane-muted">{message}</p> : null}
      </DialogChrome>
    );
  }

  return (
    <DialogChrome
      title="Apex Pilot"
      description="Open a recent project or start a new one."
      aria-label="Recent projects"
    >
      <div className="button-row" role="toolbar" aria-label="Project menu">
        <button type="button" onClick={() => onWizardModeChange("new")} disabled={!isBackendOnline || busy}>
          New Project
        </button>
        <button type="button" onClick={() => onWizardModeChange("open")} disabled={!isBackendOnline || busy}>
          Open Project
        </button>
        <button
          type="button"
          onClick={() => onWizardModeChange("clone")}
          disabled={!isBackendOnline || busy}
        >
          Clone Remote
        </button>
        <button
          type="button"
          className="chrome-button"
          onClick={() => onWizardModeChange("connection")}
          disabled={busy}
        >
          New Connection
        </button>
      </div>
      <p className="pane-muted">
        Use the Product Header <strong>Settings</strong> gear when a project is open, or
        Command Palette → Settings, for profile and app preferences.
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
    </DialogChrome>
  );
};
