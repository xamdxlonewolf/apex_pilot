import { useEffect, useState } from "react";

import { type BackendStatus, checkBackendHealth, getBackendConfig } from "./backend";

const statusCopy = {
  "missing-config": {
    label: "Backend not configured",
    description:
      "Development mode can run without a backend URL. The Tauri sidecar handshake will provide the loopback URL and bearer token in a later PR.",
  },
  checking: {
    label: "Checking backend",
    description: "Requesting the FastAPI health endpoint.",
  },
  online: {
    label: "Backend online",
    description: "FastAPI health endpoint returned successfully.",
  },
  offline: {
    label: "Backend offline",
    description: "The configured backend did not return a healthy response.",
  },
} satisfies Record<BackendStatus["kind"], { label: string; description: string }>;

export const App = () => {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>(() => {
    const config = getBackendConfig();

    if (!config.baseUrl) {
      return { kind: "missing-config" };
    }

    return { kind: "checking", baseUrl: config.baseUrl };
  });

  useEffect(() => {
    let isCurrent = true;

    void checkBackendHealth().then((nextStatus) => {
      if (isCurrent) {
        setBackendStatus(nextStatus);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  const copy = statusCopy[backendStatus.kind];

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="app-title">
        <p className="eyebrow">Apex Pilot Desktop</p>
        <h1 id="app-title">Local-first Oracle automation workspace</h1>
        <p className="hero-copy">
          A chat-first desktop app for Oracle and APEX development, with SQLcl MCP as the database
          execution boundary.
        </p>
      </section>

      <section className="status-grid" aria-label="Application status">
        <article className={`status-card status-card--${backendStatus.kind}`}>
          <div>
            <p className="card-label">Backend Health</p>
            <h2>{copy.label}</h2>
          </div>
          <p>{copy.description}</p>
          {"baseUrl" in backendStatus ? (
            <dl>
              <div>
                <dt>URL</dt>
                <dd>{backendStatus.baseUrl}</dd>
              </div>
              {backendStatus.kind === "online" ? (
                <>
                  <div>
                    <dt>Service</dt>
                    <dd>{backendStatus.health.service}</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>{backendStatus.health.version}</dd>
                  </div>
                </>
              ) : null}
              {backendStatus.kind === "offline" ? (
                <div>
                  <dt>Message</dt>
                  <dd>{backendStatus.message}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </article>

        <article className="status-card">
          <p className="card-label">Next Integration Point</p>
          <h2>Tauri sidecar handshake</h2>
          <p>
            A later vertical slice will start FastAPI from Tauri, inject the loopback URL and
            per-run bearer token, then enable live backend checks.
          </p>
        </article>

        <article className="status-card">
          <p className="card-label">Safety Posture</p>
          <h2>SQLcl MCP only</h2>
          <p>
            The frontend scaffold contains no direct database access and is ready to call guarded
            backend APIs as they land.
          </p>
        </article>
      </section>
    </main>
  );
};
