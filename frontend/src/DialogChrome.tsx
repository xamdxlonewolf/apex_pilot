import type { ReactNode } from "react";
import { useId } from "react";

type DialogChromeProps = Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
  secondaryAction?: ReactNode;
  primaryAction?: ReactNode;
  /** Optional status / callout above the content body. */
  banner?: ReactNode;
  className?: string;
  "aria-label"?: string;
}>;

/** Spec dialog layout: title → description → content → secondary/primary footer. */
export const DialogChrome = ({
  title,
  description,
  children,
  secondaryAction,
  primaryAction,
  banner,
  className,
  "aria-label": ariaLabel,
}: DialogChromeProps) => {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div
      className={["dialog-chrome", "funnel-screen", className].filter(Boolean).join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-label={ariaLabel}
      data-testid="dialog-chrome"
    >
      <header className="dialog-chrome-header">
        <h1 id={titleId} className="dialog-chrome-title">
          {title}
        </h1>
        {description ? (
          <p id={descriptionId} className="dialog-chrome-description">
            {description}
          </p>
        ) : null}
      </header>
      {banner}
      <div className="dialog-chrome-body">{children}</div>
      {secondaryAction || primaryAction ? (
        <footer className="dialog-chrome-footer" data-testid="dialog-chrome-footer">
          <div className="dialog-chrome-footer-secondary">{secondaryAction}</div>
          <div className="dialog-chrome-footer-primary">{primaryAction}</div>
        </footer>
      ) : null}
    </div>
  );
};
