import type { ButtonHTMLAttributes } from "react";

/**
 * Shared Stub convention constants (ADR-0007 §11 / UI-9).
 *
 * Planning IDs (`DS-*` / `UI-*`) and Gap markings stay in docs/tickets/comments —
 * never in user-visible stub UI. Working interim paths (e.g. no-project floating
 * MCP fallback) must not use Stub chrome. Product MCP Activity lives in the
 * Developer Console tab.
 */

/** Exact chrome badge text for unfinished Spec surfaces. */
export const STUB_BADGE = "Stub";

/** Exact primary user copy for unfinished Spec surfaces. */
export const STUB_PRIMARY_COPY = "Not implemented yet";

/** Patterns that must never appear in product Stub UI. */
export const FORBIDDEN_STUB_UI_PATTERNS: ReadonlyArray<RegExp> = [
  /\bGap\b/,
  /\bDS-[A-Z0-9][A-Z0-9_-]*/i,
  /\bUI-\d+\b/i,
];

export const containsForbiddenStubUiCopy = (text: string): boolean =>
  FORBIDDEN_STUB_UI_PATTERNS.some((pattern) => pattern.test(text));

type StubActionProps = Readonly<
  Pick<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "title" | "aria-disabled">
>;

/**
 * Props for Spec-layout actions that cannot work yet.
 * Always disabled; title defaults to the stub primary copy.
 */
export const stubActionProps = (hint: string = STUB_PRIMARY_COPY): StubActionProps => {
  if (containsForbiddenStubUiCopy(hint)) {
    throw new Error(
      "Stub action hints must not include Gap markings or DS-* / UI-* planning IDs.",
    );
  }
  return {
    disabled: true,
    "aria-disabled": true,
    title: hint,
  };
};
