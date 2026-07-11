import { useState } from "react";

import { StubBadge, StubChromeTitle, StubMessage } from "./StubSurface";
import { stubActionProps } from "./stubConvention";

type MissionComposerProps = Readonly<{
  projectName: string | null;
}>;

const MISSION_STAGES = [
  { id: "plan", label: "Plan" },
  { id: "sql", label: "SQL" },
  { id: "review", label: "Review" },
  { id: "exec", label: "Exec" },
] as const;

const HISTORY_BUCKETS = ["Recent", "Today", "Yesterday", "Earlier"] as const;

export const MissionComposer = ({ projectName }: MissionComposerProps) => {
  const [draft, setDraft] = useState("");
  const secondary = projectName
    ? `Agent Core is required to run Mission prompts for ${projectName}.`
    : "Agent Core is required to run Mission prompts.";

  return (
    <div className="mission-surface" data-testid="mission-surface">
      <StubChromeTitle title="Mission" />
      <div className="mission-layout">
        <aside className="mission-history" aria-label="Mission history">
          <div className="mission-history-header">
            <strong>History</strong>
            <StubBadge />
          </div>
          <StubMessage secondary="Mission history arrives with Agent Core persistence." />
          <ul className="mission-history-buckets">
            {HISTORY_BUCKETS.map((bucket) => (
              <li key={bucket}>
                <span className="mission-history-bucket">{bucket}</span>
                <span className="pane-muted">No missions yet</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="mission-workspace">
          <div className="mission-pane-body">
            <section className="mission-card" aria-label="Mission card">
              <div className="mission-card-header">
                <strong>Mission card</strong>
                <StubBadge />
              </div>
              <dl className="mission-card-fields">
                <div>
                  <dt>Status</dt>
                  <dd className="pane-muted">Waiting for Agent Core</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd className="pane-muted">—</dd>
                </div>
                <div>
                  <dt>Connection</dt>
                  <dd className="pane-muted">—</dd>
                </div>
                <div>
                  <dt>Working Schema</dt>
                  <dd className="pane-muted">—</dd>
                </div>
              </dl>
            </section>

            <section className="mission-timeline" aria-label="Mission timeline">
              <div className="mission-timeline-header">
                <strong>Timeline</strong>
                <StubBadge />
              </div>
              <ol className="mission-stages" aria-label="Mission stages">
                {MISSION_STAGES.map((stage) => (
                  <li key={stage.id} className="mission-stage" data-stage={stage.id}>
                    <span className="mission-stage-label">{stage.label}</span>
                    <StubBadge />
                    <span className="pane-muted">Not started</span>
                  </li>
                ))}
              </ol>
            </section>

            <StubMessage secondary={secondary} />
          </div>

          <form
            className="mission-composer"
            aria-label="Mission composer"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <label className="sr-only" htmlFor="mission-composer">
              Mission prompt
            </label>
            <textarea
              id="mission-composer"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Describe your mission… (Agent Core coming next)"
              rows={3}
            />
            <button type="submit" {...stubActionProps()}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
