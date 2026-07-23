import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useState } from "react";

export type CodeEditorMarker = Readonly<{
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: "error" | "warning" | "info";
}>;

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
  markers?: readonly CodeEditorMarker[];
  onMount?: OnMount;
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
  markers = [],
  onMount,
}: CodeEditorProps) => {
  const locked = readOnly || disabled;
  const [mountedEditor, setMountedEditor] = useState<Parameters<OnMount>[0] | null>(null);
  const [mountedMonaco, setMountedMonaco] = useState<Parameters<OnMount>[1] | null>(null);

  useEffect(() => {
    const model = mountedEditor?.getModel();
    if (!model || !mountedMonaco) {
      return;
    }
    mountedMonaco.editor.setModelMarkers(
      model,
      "apex-pilot",
      markers.map((marker) => ({
        ...marker,
        severity:
          marker.severity === "error"
            ? mountedMonaco.MarkerSeverity.Error
            : marker.severity === "warning"
              ? mountedMonaco.MarkerSeverity.Warning
              : mountedMonaco.MarkerSeverity.Info,
      })),
    );
  }, [markers, mountedEditor, mountedMonaco]);

  useEffect(() => {
    if (!mountedEditor) {
      return;
    }
    const el = mountedEditor.getContainerDomNode()?.parentElement;
    if (!el || typeof ResizeObserver === "undefined") {
      mountedEditor.layout();
      return;
    }
    const ro = new ResizeObserver(() => mountedEditor.layout());
    ro.observe(el);
    mountedEditor.layout();
    return () => ro.disconnect();
  }, [mountedEditor]);

  return (
    <div className={`code-editor${className ? ` ${className}` : ""}`} data-language={language}>
      <Editor
        path={id}
        language={language}
        value={value}
        theme="vs-dark"
        height="100%"
        loading={<p className="pane-muted">Loading editor…</p>}
        onMount={(editor, monaco) => {
          setMountedEditor(editor);
          setMountedMonaco(monaco);
          onMount?.(editor, monaco);
        }}
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
