import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import type {
  BackendStatus,
  InteractivePoolStatus,
  OpenedProject,
  SavedConnection,
} from "./backend";
import { backendHealthLabel, environmentIdentity, interactiveHealthLabel } from "./shellHealth";

type ProductHeaderProps = Readonly<{
  openedProject: OpenedProject;
  backendStatus: BackendStatus;
  isBackendOnline: boolean;
  connections: SavedConnection[];
  selectedConnection: string;
  onSelectedConnectionChange: (name: string) => void;
  connectedConnection: string | null;
  onConnect: (connectionName?: string) => Promise<void> | void;
  isConnecting: boolean;
  workingSchema: string;
  onWorkingSchemaChange: (schema: string) => void;
  interactiveStatus: InteractivePoolStatus;
  onOpenSettings: () => void;
  onInteractiveReconnect?: () => void;
  interactiveReconnectBusy?: boolean;
}>;

/**
 * Dense Product Header: brand + Context Bar role + Settings gear.
 * Context Bar is a role hosted here — not a second stacked chrome strip.
 * SQLcl connection name lives on select + Connect; health pills report Backend
 * and interactive driver binding availability independently (ADR-0008).
 */
export const ProductHeader = ({
  openedProject,
  backendStatus,
  isBackendOnline,
  connections,
  selectedConnection,
  onSelectedConnectionChange,
  connectedConnection,
  onConnect,
  isConnecting,
  workingSchema,
  onWorkingSchemaChange,
  interactiveStatus,
  onOpenSettings,
  onInteractiveReconnect,
  interactiveReconnectBusy = false,
}: ProductHeaderProps) => {
  const environment = environmentIdentity(openedProject.manifest);
  const backendHealth = backendHealthLabel(backendStatus);
  const interactiveHealth = interactiveHealthLabel(interactiveStatus);
  const canManualInteractiveReconnect =
    Boolean(onInteractiveReconnect) &&
    Boolean(interactiveStatus.has_session_password) &&
    (interactiveStatus.state === "disconnected" || interactiveStatus.state === "dead");

  const onContextKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "button:not(:disabled), select:not(:disabled), input:not(:disabled)",
      ),
    );
    const index = items.indexOf(event.target as HTMLElement);
    if (index < 0) {
      return;
    }
    event.preventDefault();
    const next =
      event.key === "ArrowRight"
        ? items[(index + 1) % items.length]
        : items[(index - 1 + items.length) % items.length];
    next?.focus();
  };

  return (
    <header className="product-header" aria-label="Product Header">
      <span className="product-brand">Apex Pilot</span>

      <div
        className="product-header-context"
        role="region"
        aria-label="Context Bar"
        onKeyDown={onContextKeyDown}
      >
        <span className="context-field" aria-label="Project">
          <span className="context-label">Project</span>
          <strong>{openedProject.project.name}</strong>
        </span>
        <label className="context-field" htmlFor="workspace-connection">
          <span className="context-label">Connection</span>
          <select
            id="workspace-connection"
            value={selectedConnection}
            onChange={(event) => onSelectedConnectionChange(event.target.value)}
            disabled={!isBackendOnline || isConnecting || connections.length === 0}
          >
            {connections.length === 0 ? <option value="">No connections</option> : null}
            {connections.map((connection) => (
              <option key={connection.name} value={connection.name}>
                {connection.display_name
                  ? `${connection.display_name} (${connection.name})`
                  : connection.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="chrome-button"
          onClick={() => void onConnect()}
          disabled={!isBackendOnline || isConnecting || !selectedConnection}
          aria-busy={isConnecting}
        >
          {isConnecting
            ? "Connecting…"
            : connectedConnection === selectedConnection
              ? "Connected · Reconnect"
              : connectedConnection
                ? "Switch connection"
                : "Connect"}
        </button>
        {canManualInteractiveReconnect ? (
          <button
            type="button"
            className="chrome-button"
            onClick={() => onInteractiveReconnect?.()}
            disabled={!isBackendOnline || interactiveReconnectBusy}
            aria-busy={interactiveReconnectBusy}
          >
            {interactiveReconnectBusy ? "Reconnecting…" : "Reconnect interactive"}
          </button>
        ) : null}
        <label className="context-field" htmlFor="workspace-working-schema">
          <span className="context-label">Working Schema</span>
          <input
            id="workspace-working-schema"
            value={workingSchema}
            onChange={(event) => onWorkingSchemaChange(event.target.value)}
            placeholder="Schema"
            spellCheck={false}
          />
        </label>
        <span className="context-field" aria-label="Environment">
          <span className="context-label">Environment</span>
          <span className="env-badge" translate="no">
            {environment}
          </span>
        </span>
        <div className="context-health" role="group" aria-label="Health indicators">
          <span
            className={`health-pill health-pill--${backendHealth.tone}`}
            aria-label="Backend health"
          >
            <span className="health-pill-dot" aria-hidden="true" />
            {backendHealth.label}
          </span>
          <span
            className={`health-pill health-pill--${interactiveHealth.tone}`}
            aria-label="Interactive database"
          >
            <span className="health-pill-dot" aria-hidden="true" />
            {interactiveHealth.label}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="chrome-button product-header-settings"
        onClick={onOpenSettings}
        title="Settings"
        aria-label="Open Settings"
      >
        Settings
      </button>
    </header>
  );
};
