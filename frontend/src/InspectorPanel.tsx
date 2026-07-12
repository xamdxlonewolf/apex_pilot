import { useState } from "react";

import { StubBadge, StubSurface } from "./StubSurface";
import { stubActionProps } from "./stubConvention";

type InspectorPanelProps = Readonly<{
  projectName: string | null;
  connectionName: string | null;
  workingSchema: string;
}>;

const INSPECTOR_STAGES = [
  { id: "plan", label: "Plan" },
  { id: "sql-generated", label: "SQL Generated" },
  { id: "review", label: "Review" },
  { id: "execute", label: "Execute" },
  { id: "complete", label: "Complete" },
] as const;

type InspectorStageId = (typeof INSPECTOR_STAGES)[number]["id"];

/**
 * Right-pane Inspector: stage-driven Mission evidence chrome
 * (Plan → SQL Generated → Review → Execute → Complete).
 * Explains; does not initiate work or own SQL edit/run.
 * Before Agent Core: honest empty/stub evidence — never fake plans, SQL, or success.
 */
export const InspectorPanel = ({
  projectName,
  connectionName,
  workingSchema,
}: InspectorPanelProps) => {
  const [activeStageId, setActiveStageId] = useState<InspectorStageId>("plan");

  const missionSecondary = projectName
    ? `Agent Core is required to inspect Mission evidence for ${projectName}.`
    : "Agent Core is required to inspect Mission evidence.";
  const contextLine = [
    connectionName ? `Connection ${connectionName}` : "No connection",
    workingSchema.trim() ? `Working Schema ${workingSchema.trim()}` : "Working Schema unset",
  ].join(" · ");

  const activeStage =
    INSPECTOR_STAGES.find((stage) => stage.id === activeStageId) ?? INSPECTOR_STAGES[0];

  return (
    <div className="inspector-panel" aria-label="Inspector panel">
      <div className="pane-header">
        <strong>Inspector</strong>
        <span className="pane-muted inspector-context">{contextLine}</span>
      </div>
      <div className="inspector-body">
        <nav className="inspector-stages" aria-label="Inspector stages">
          <ol className="inspector-stage-list">
            {INSPECTOR_STAGES.map((stage) => {
              const isActive = stage.id === activeStageId;
              return (
                <li key={stage.id} className="inspector-stage-item" data-stage={stage.id}>
                  <button
                    type="button"
                    className={
                      isActive
                        ? "inspector-stage-button inspector-stage-button--active"
                        : "inspector-stage-button"
                    }
                    aria-label={stage.label}
                    aria-current={isActive ? "step" : undefined}
                    onClick={() => setActiveStageId(stage.id)}
                  >
                    <span className="inspector-stage-marker" aria-hidden="true" />
                    <span className="inspector-stage-copy">
                      <span className="inspector-stage-label">{stage.label}</span>
                      {!isActive ? (
                        <span className="pane-muted inspector-stage-state">Waiting</span>
                      ) : (
                        <span className="inspector-stage-state">
                          <StubBadge />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section
          className="inspector-stage-evidence"
          role="region"
          aria-label={`${activeStage.label} stage`}
        >
          {activeStageId === "plan" ? (
            <StubSurface
              title="Plan"
              secondary={missionSecondary}
              bodyClassName="inspector-section-body"
              actions={
                <button type="button" {...stubActionProps()}>
                  Generate SQL
                </button>
              }
            />
          ) : null}

          {activeStageId === "sql-generated" ? (
            <StubSurface
              title="SQL Generated"
              secondary="Generated SQL arrives with Mission SQL review. No sample SQL is shown here."
              bodyClassName="inspector-section-body"
              actions={
                <div className="inspector-stage-actions">
                  <button type="button" {...stubActionProps()}>
                    Open in Editor
                  </button>
                  <button type="button" {...stubActionProps()}>
                    Copy
                  </button>
                  <button type="button" {...stubActionProps()}>
                    Download
                  </button>
                  <button type="button" {...stubActionProps()}>
                    Review & Approve
                  </button>
                </div>
              }
            />
          ) : null}

          {activeStageId === "review" ? (
            <StubSurface
              title="Review"
              secondary="Review evidence and classification arrive with Agent Core Mission review."
              bodyClassName="inspector-section-body"
              actions={
                <button type="button" {...stubActionProps()}>
                  Execute
                </button>
              }
            />
          ) : null}

          {activeStageId === "execute" ? (
            <StubSurface
              title="Execute"
              secondary="Live execution progress arrives when Agent Core runs Missions through SQLcl MCP."
              bodyClassName="inspector-section-body"
            />
          ) : null}

          {activeStageId === "complete" ? (
            <StubSurface
              title="Complete"
              secondary="Completion stats arrive after a real Mission execute. No successful run is simulated."
              bodyClassName="inspector-section-body"
              actions={
                <div className="inspector-stage-actions">
                  <button type="button" {...stubActionProps()}>
                    Open Log
                  </button>
                  <button type="button" {...stubActionProps()}>
                    View Changes
                  </button>
                </div>
              }
            />
          ) : null}
        </section>
      </div>
    </div>
  );
};
