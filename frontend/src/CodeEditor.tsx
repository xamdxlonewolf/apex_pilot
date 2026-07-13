import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

import type { editor as MonacoEditor } from "monaco-editor";

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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
    // Immediate layout so the first paint matches the current pane width.
    editor.layout();
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      // Re-layout on host shrink/grow — automaticLayout alone can stick wide after
      // window grow→shrink when ancestors briefly report a larger content width.
      editorRef.current?.layout();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={hostRef}
      className={`code-editor${className ? ` ${className}` : ""}`}
      data-language={language}
    >
      <Editor
        path={id}
        language={language}
        value={value}
        width="100%"
        height="100%"
        theme="vs-dark"
        loading={<p className="pane-muted">Loading editor…</p>}
        onMount={onMount}
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
          scrollbar: {
            // Keep Monaco's own bar; hide when content fits (word wrap on).
            horizontal: "auto",
            vertical: "auto",
            alwaysConsumeMouseWheel: false,
          },
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
