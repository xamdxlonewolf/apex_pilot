import { useState } from "react";

import { StubBadge, StubMessage } from "./StubSurface";
import { STUB_PRIMARY_COPY, stubActionProps } from "./stubConvention";
import { WizardChrome } from "./WizardChrome";

const CONNECTION_WIZARD_STEPS = [
  "Connection Type",
  "Credentials",
  "Validation",
  "Working Schema",
  "Summary",
] as const;

type ConnectionWizardProps = Readonly<{
  onCancel: () => void;
}>;

/**
 * Spec connection wizard chrome. Creating SQLcl saved connections is unfinished —
 * Finish stays Stub-disabled with no fake success path.
 */
export const ConnectionWizard = ({ onCancel }: ConnectionWizardProps) => {
  const [stepIndex, setStepIndex] = useState(0);
  const step = CONNECTION_WIZARD_STEPS[stepIndex] ?? CONNECTION_WIZARD_STEPS[0];

  return (
    <WizardChrome
      title="New connection"
      description="SQLcl saved connections stay with the Oracle client. Apex Pilot does not store passwords."
      steps={CONNECTION_WIZARD_STEPS}
      activeStepIndex={stepIndex}
      onBack={() => setStepIndex((current) => Math.max(0, current - 1))}
      onNext={() =>
        setStepIndex((current) => Math.min(CONNECTION_WIZARD_STEPS.length - 1, current + 1))
      }
      onCancel={onCancel}
      onFinish={() => undefined}
      canFinish={false}
      finishDisabledTitle={STUB_PRIMARY_COPY}
      titleTrailing={<StubBadge />}
    >
      <div className="wizard-step-panel" aria-label={step}>
        <StubMessage secondary="Connection create/import arrives with SQLcl connection management." />
        <p className="pane-muted">
          Use an existing SQLcl saved connection from the Context Bar after a project is open.
        </p>
        <button type="button" className="chrome-button" {...stubActionProps()}>
          Test connection
        </button>
      </div>
    </WizardChrome>
  );
};

export { CONNECTION_WIZARD_STEPS };
