import { StubSurface } from "./StubSurface";

type InspectorPanelProps = Readonly<{
  projectName: string | null;
  connectionName: string | null;
  workingSchema: string;
}>;

/**
 * Right-pane Inspector: explains Mission evidence (progress, classification,
 * object summaries, checklists). Does not initiate work or own SQL edit/run.
 */
export const InspectorPanel = ({
  projectName,
  connectionName,
  workingSchema,
}: InspectorPanelProps) => {
  const missionSecondary = projectName
    ? `Agent Core is required to inspect Mission evidence for ${projectName}.`
    : "Agent Core is required to inspect Mission evidence.";
  const contextLine = [
    connectionName ? `Connection ${connectionName}` : "No connection",
    workingSchema.trim() ? `Working Schema ${workingSchema.trim()}` : "Working Schema unset",
  ].join(" · ");

  return (
    <div className="inspector-panel" aria-label="Inspector panel">
      <div className="pane-header">
        <strong>Inspector</strong>
        <span className="pane-muted inspector-context">{contextLine}</span>
      </div>
      <div className="inspector-body">
        <section className="inspector-section" role="region" aria-label="Workflow progress">
          <StubSurface
            title="Progress"
            secondary={missionSecondary}
            bodyClassName="inspector-section-body"
          />
        </section>
        <section className="inspector-section" role="region" aria-label="Classification">
          <StubSurface
            title="Classification"
            secondary="Classification evidence arrives with Mission SQL review."
            bodyClassName="inspector-section-body"
          />
        </section>
        <section className="inspector-section" role="region" aria-label="Object summaries">
          <StubSurface
            title="Object summaries"
            secondary="Object and dependency summaries arrive with schema impact analysis."
            bodyClassName="inspector-section-body"
          />
        </section>
        <section className="inspector-section" role="region" aria-label="Checklist">
          <StubSurface
            title="Checklist"
            secondary="Planning checklists arrive with Mission plan approval."
            bodyClassName="inspector-section-body"
          />
        </section>
        <section className="inspector-section" role="region" aria-label="Mappings preferences">
          <StubSurface
            title="Mappings"
            secondary="Environment mappings move to connection and preferences UX."
            bodyClassName="inspector-section-body"
          />
        </section>
      </div>
    </div>
  );
};
