import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { vi } from "vitest";

/** Monaco needs workers/DOM APIs jsdom lacks — mock as a labeled textarea for tests. */
vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
    path,
    options,
  }: {
    value?: string;
    onChange?: (value: string | undefined) => void;
    path?: string;
    options?: { ariaLabel?: string; readOnly?: boolean };
  }) =>
    createElement("textarea", {
      id: path,
      "aria-label": options?.ariaLabel,
      value: value ?? "",
      readOnly: Boolean(options?.readOnly),
      disabled: Boolean(options?.readOnly),
      spellCheck: false,
      onChange: (event: { target: { value: string } }) => onChange?.(event.target.value),
    }),
}));
