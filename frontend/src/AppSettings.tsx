import { type FormEvent, useState } from "react";

import {
  type BackendConfig,
  type LocalProfile,
  type OpenedProject,
  type SavedConnection,
  createProfile,
} from "./backend";
import { DialogChrome } from "./DialogChrome";
import {
  EXPLORER_MIN_WIDTH,
  INSPECTOR_MIN_WIDTH,
  clampExplorerWidth,
  clampInspectorWidth,
} from "./panelLayout";
import {
  type ActivityRailLabelsMode,
  type DensityMode,
  type ProfileLayoutPrefs,
  defaultProfileLayout,
  loadProfileLayout,
  saveProfileLayout,
} from "./prefs";
import { ProjectMappings } from "./ProjectMappings";

type AppSettingsProps = Readonly<{
  backendConfig: BackendConfig;
  profiles: LocalProfile[];
  selectedProfileId: string;
  connections: SavedConnection[];
  openedProject: OpenedProject | null;
  onOpenedProjectChange: (project: OpenedProject | null) => void;
  onProfilesChange: (profiles: LocalProfile[], selectedProfileId: string) => void;
  onClose: () => void;
}>;

const densityOptions: ReadonlyArray<Readonly<{ value: DensityMode; label: string }>> = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "comfortable", label: "Comfortable" },
];

const activityRailLabelsOptions: ReadonlyArray<
  Readonly<{ value: ActivityRailLabelsMode; label: string }>
> = [
  { value: "auto", label: "Auto (by window width)" },
  { value: "icons", label: "Icons only" },
  { value: "icons-labels", label: "Icons + labels" },
];

export const AppSettings = ({
  backendConfig,
  profiles,
  selectedProfileId,
  connections,
  openedProject,
  onOpenedProjectChange,
  onProfilesChange,
  onClose,
}: AppSettingsProps) => {
  const [activeProfileId, setActiveProfileId] = useState(selectedProfileId);
  const [layout, setLayout] = useState<ProfileLayoutPrefs>(() =>
    loadProfileLayout(selectedProfileId || null),
  );
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreateProfile, setShowCreateProfile] = useState(profiles.length === 0);

  if (selectedProfileId !== activeProfileId) {
    setActiveProfileId(selectedProfileId);
    setLayout(loadProfileLayout(selectedProfileId || null));
  }

  const activeProfile = profiles.find((profile) => profile.profile_id === activeProfileId) ?? null;

  const persistLayout = (next: ProfileLayoutPrefs) => {
    setLayout(next);
    if (activeProfileId) {
      saveProfileLayout(activeProfileId, next);
    }
  };

  const handleSelectProfile = (profileId: string) => {
    setActiveProfileId(profileId);
    onProfilesChange(profiles, profileId);
    setLayout(loadProfileLayout(profileId));
    setMessage("Active profile updated.");
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
      saveProfileLayout(profile.profile_id, defaultProfileLayout());
      onProfilesChange(nextProfiles, profile.profile_id);
      setActiveProfileId(profile.profile_id);
      setLayout(defaultProfileLayout());
      setDisplayName("");
      setEmail("");
      setUsername("");
      setShowCreateProfile(false);
      setMessage(`Created profile ${profile.display_name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogChrome
      title="Settings"
      description="Profile and app preferences for this machine. Environment → SQLcl / APEX mappings stay with the open project. Preferences are not a wizard."
      aria-label="Settings"
      onClose={onClose}
      primaryAction={
        <button type="button" onClick={onClose}>
          Done
        </button>
      }
    >
      <section className="settings-section" aria-labelledby="settings-profile-heading">
        <h2 id="settings-profile-heading">Local profile</h2>
        {profiles.length > 0 ? (
          <>
            <label>
              Active profile
              <select
                value={activeProfileId}
                onChange={(event) => handleSelectProfile(event.target.value)}
              >
                {profiles.map((profile) => (
                  <option key={profile.profile_id} value={profile.profile_id}>
                    {profile.display_name}
                  </option>
                ))}
              </select>
            </label>
            {activeProfile ? (
              <dl className="compact-dl settings-profile-meta">
                <div>
                  <dt>Display name</dt>
                  <dd>{activeProfile.display_name}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{activeProfile.email || "—"}</dd>
                </div>
                <div>
                  <dt>Username</dt>
                  <dd>{activeProfile.username || "—"}</dd>
                </div>
              </dl>
            ) : null}
          </>
        ) : (
          <p className="pane-muted">No profiles yet. Create one below.</p>
        )}
        {!showCreateProfile ? (
          <button
            type="button"
            className="chrome-button"
            onClick={() => setShowCreateProfile(true)}
          >
            Add another profile
          </button>
        ) : (
          <form className="stack-form" onSubmit={(event) => void handleCreateProfile(event)}>
            <h3>New profile</h3>
            <label>
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </label>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <div className="button-row">
              <button type="submit" disabled={busy || !displayName.trim()}>
                Create profile
              </button>
              {profiles.length > 0 ? (
                <button
                  type="button"
                  className="chrome-button"
                  onClick={() => setShowCreateProfile(false)}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        )}
      </section>

      <section className="settings-section" aria-labelledby="settings-app-heading">
        <h2 id="settings-app-heading">App preferences</h2>
        <p className="pane-muted">Stored for the active profile on this machine.</p>
        <label>
          Density
          <select
            value={layout.density}
            onChange={(event) =>
              persistLayout({
                ...layout,
                density: event.target.value as DensityMode,
              })
            }
            disabled={!activeProfileId}
          >
            {densityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Activity Rail labels
          <select
            value={layout.activityRailLabels}
            onChange={(event) =>
              persistLayout({
                ...layout,
                activityRailLabels: event.target.value as ActivityRailLabelsMode,
              })
            }
            disabled={!activeProfileId}
          >
            {activityRailLabelsOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={layout.skipDestructiveSqlPrompt}
            onChange={(event) =>
              persistLayout({
                ...layout,
                skipDestructiveSqlPrompt: event.target.checked,
              })
            }
            disabled={!activeProfileId}
          />
          Skip destructive SQL sheet confirmation prompts
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={layout.autoReconnectInteractive}
            onChange={(event) =>
              persistLayout({
                ...layout,
                autoReconnectInteractive: event.target.checked,
              })
            }
            disabled={!activeProfileId}
          />
          Auto-reconnect interactive pool after idle disconnect
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={layout.blockCloseOnCompileWarnings}
            onChange={(event) =>
              persistLayout({
                ...layout,
                blockCloseOnCompileWarnings: event.target.checked,
              })
            }
            disabled={!activeProfileId}
          />
          Block Database Source Document close when compile has warnings
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={layout.showJunkFiles}
            onChange={(event) =>
              persistLayout({
                ...layout,
                showJunkFiles: event.target.checked,
              })
            }
            disabled={!activeProfileId}
          />
          Show junk / noise files in the project tree by default
        </label>
        <div className="settings-widths">
          <label>
            Left pane width (px)
            <input
              type="number"
              min={EXPLORER_MIN_WIDTH}
              max={640}
              value={layout.leftWidth}
              disabled={!activeProfileId}
              onChange={(event) =>
                persistLayout({
                  ...layout,
                  leftWidth: clampExplorerWidth(
                    Number(event.target.value) || layout.leftWidth,
                  ),
                })
              }
            />
          </label>
          <label>
            Right pane width (px)
            <input
              type="number"
              min={INSPECTOR_MIN_WIDTH}
              max={720}
              value={layout.rightWidth}
              disabled={!activeProfileId}
              onChange={(event) =>
                persistLayout({
                  ...layout,
                  rightWidth: clampInspectorWidth(
                    Number(event.target.value) || layout.rightWidth,
                  ),
                })
              }
            />
          </label>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-mappings-heading">
        <h2 id="settings-mappings-heading">Environment mappings</h2>
        {openedProject ? (
          <ProjectMappings
            backendConfig={backendConfig}
            connections={connections}
            openedProject={openedProject}
            onOpenedProjectChange={onOpenedProjectChange}
          />
        ) : (
          <p className="pane-muted">
            Open a project to map logical environments and APEX workspaces to local SQLcl saved
            connections.
          </p>
        )}
      </section>

      {message ? <p className="pane-muted">{message}</p> : null}
    </DialogChrome>
  );
};
