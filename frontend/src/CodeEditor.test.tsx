import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CodeEditor } from "./CodeEditor";

describe("CodeEditor", () => {
  it("exposes a labeled editable surface and reports changes", () => {
    const onChange = vi.fn();
    render(
      <CodeEditor
        id="test-editor"
        language="typescript"
        value="const x = 1;"
        aria-label="Sample editor"
        onChange={onChange}
      />,
    );

    const editor = screen.getByLabelText("Sample editor");
    expect(editor).toHaveValue("const x = 1;");
    fireEvent.change(editor, { target: { value: "const x = 2;" } });
    expect(onChange).toHaveBeenCalledWith("const x = 2;");
  });

  it("ignores edits when read-only", () => {
    const onChange = vi.fn();
    render(
      <CodeEditor
        id="ro-editor"
        language="python"
        value="print('hi')"
        aria-label="Read-only sample"
        readOnly
        onChange={onChange}
      />,
    );

    const editor = screen.getByLabelText("Read-only sample");
    expect(editor).toHaveAttribute("readonly");
    fireEvent.change(editor, { target: { value: "print('nope')" } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
