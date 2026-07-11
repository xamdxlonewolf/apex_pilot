import type { ReactNode } from "react";
import { useId } from "react";

type WizardChromeProps = Readonly<{
  title: string;
  description?: string;
  steps: ReadonlyArray<string>;
  activeStepIndex: number;
  children: ReactNode;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  onFinish: () => void;
  canFinish?: boolean;
  finishDisabledTitle?: string;
  busy?: boolean;
  /** Extra chrome beside the title (e.g. Stub badge). */
  titleTrailing?: ReactNode;
  className?: string;
}>;

/** Spec wizard layout: visible steps → content → Back/Next/Finish/Cancel footer. */
export const WizardChrome = ({
  title,
  description,
  steps,
  activeStepIndex,
  children,
  onBack,
  onNext,
  onCancel,
  onFinish,
  canFinish = false,
  finishDisabledTitle,
  busy = false,
  titleTrailing,
  className,
}: WizardChromeProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const isFirst = activeStepIndex <= 0;
  const isLast = activeStepIndex >= steps.length - 1;

  return (
    <div
      className={["wizard-chrome", "funnel-screen", className].filter(Boolean).join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-testid="wizard-chrome"
    >
      <header className="wizard-chrome-header">
        <div className="wizard-chrome-title-row">
          <h1 id={titleId} className="wizard-chrome-title">
            {title}
          </h1>
          {titleTrailing}
        </div>
        {description ? (
          <p id={descriptionId} className="wizard-chrome-description">
            {description}
          </p>
        ) : null}
      </header>

      <ol className="wizard-steps" aria-label="Wizard steps">
        {steps.map((step, index) => {
          const state =
            index === activeStepIndex ? "current" : index < activeStepIndex ? "done" : "upcoming";
          return (
            <li
              key={step}
              className={`wizard-step wizard-step--${state}`}
              aria-current={index === activeStepIndex ? "step" : undefined}
            >
              <span className="wizard-step-index" aria-hidden="true">
                {index + 1}
              </span>
              <span className="wizard-step-label">{step}</span>
            </li>
          );
        })}
      </ol>

      <div className="wizard-chrome-body">{children}</div>

      <footer className="wizard-chrome-footer" data-testid="wizard-chrome-footer">
        <button type="button" className="chrome-button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <div className="wizard-chrome-footer-nav">
          <button
            type="button"
            className="chrome-button"
            onClick={onBack}
            disabled={busy || isFirst}
          >
            Back
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={onFinish}
              disabled={busy || !canFinish}
              title={!canFinish ? finishDisabledTitle : undefined}
            >
              Finish
            </button>
          ) : (
            <button type="button" onClick={onNext} disabled={busy}>
              Next
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
