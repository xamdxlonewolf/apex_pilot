import Editor from "@monaco-editor/react";

export type CodeEditorProps = Readonly<{
  /** Stable id — used as Monaco model path and optional DOM id for labels. */
  id: string;
  value: string;
  language: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}>;

/**
 * Shared Workspace code-editor surface (Monaco).
 * Used by the SQL Editor and File Editor tabs.
 */
export const CodeEditor = ({
  id,
  value,
  language,
  onChange,
  readOnly = false,
  disabled = false,
  "aria-label": ariaLabel,
  className,
}: CodeEditorProps) => {
  const locked = readOnly || disabled;

  return (
    <div className={`code-editor${className ? ` ${className}` : ""}`} data-language={language}>
      <Editor
        path={id}
        language={language}
        value={value}
        theme="vs-dark"
        loading={<p className="pane-muted">Loading editor…</p>}
        onChange={(next) => {
          if (locked) {
            return;
          }
          onChange?.(next ?? "");
        }}
        options={{
          readOnly: locked,
          domReadOnly: locked,
          ariaLabel,
          fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, ui-monospace, monospace',
          fontSize: 13,
          lineHeight: 20,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "on",
          tabSize: 2,
          renderLineHighlight: locked ? "none" : "line",
          padding: { top: 8, bottom: 8 },
        }}
      />
    </div>
  );
};
