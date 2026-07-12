import { describe, expect, it } from "vitest";

import { languageFromPath } from "./editorLanguages";

describe("languageFromPath", () => {
  it("maps common project extensions to Monaco languages", () => {
    expect(languageFromPath("src/app.ts")).toBe("typescript");
    expect(languageFromPath("scripts/run.py")).toBe("python");
    expect(languageFromPath("styles/main.css")).toBe("css");
    expect(languageFromPath("pkg/body.pkb")).toBe("sql");
    expect(languageFromPath("query.sql")).toBe("sql");
    expect(languageFromPath("ui/Button.tsx")).toBe("typescript");
    expect(languageFromPath("lib/util.js")).toBe("javascript");
    expect(languageFromPath("docs/readme.md")).toBe("markdown");
    expect(languageFromPath("config.yaml")).toBe("yaml");
  });

  it("handles Windows paths and unknown extensions", () => {
    expect(languageFromPath("C:\\proj\\src\\main.py")).toBe("python");
    expect(languageFromPath("notes.txt")).toBe("plaintext");
    expect(languageFromPath(null)).toBe("plaintext");
    expect(languageFromPath(undefined)).toBe("plaintext");
  });
});
