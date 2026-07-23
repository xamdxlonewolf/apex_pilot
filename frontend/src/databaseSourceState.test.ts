import { describe, expect, it } from "vitest";

import {
  createDatabaseSourceState,
  withBufferText,
  withGlobalContextChange,
} from "./databaseSourceState";
import { planDatabaseSourceAction } from "./databaseSourceActions";

describe("Database Source Document state", () => {
  it("keeps its sticky target when the global Context Bar changes", () => {
    const state = createDatabaseSourceState({
      target: {
        connectionProfileId: "dev",
        workingSchema: "HR",
        owner: "HR",
        objectTypes: ["PACKAGE"],
        name: "EMPLOYEES_API",
      },
      savedText: "create package employees_api as end;",
    });

    const changed = withGlobalContextChange(state, "prod", "HR_APP");

    expect(changed).toMatchObject({
      target: state.target,
      globalContextMismatch: true,
      globalContext: { connectionProfileId: "prod", workingSchema: "HR_APP" },
    });
    expect(changed.target).not.toBe(state.target);
  });

  it("marks a local buffer edit dirty without changing saved text", () => {
    const state = createDatabaseSourceState({
      target: {
        connectionProfileId: "dev",
        workingSchema: "HR",
        owner: "HR",
        objectTypes: ["VIEW"],
        name: "EMPLOYEES_V",
      },
      savedText: "select * from employees",
    });

    const edited = withBufferText(state, "select employee_id from employees");

    expect(edited).toMatchObject({
      dirty: true,
      savedText: "select * from employees",
      bufferText: "select employee_id from employees",
    });
  });

  it("plans Save & Compile as a local save followed by the exact saved buffer compile", () => {
    const document = createDatabaseSourceState({
      target: {
        connectionProfileId: "dev",
        workingSchema: "HR",
        owner: "HR",
        objectTypes: ["PACKAGE"],
        name: "EMPLOYEES_API",
      },
      savedText: "create package employees_api as end;",
      bufferText: "create package employees_api as procedure p; end;",
      baselineFingerprints: { saved: "old", database: "db" },
    });

    expect(planDatabaseSourceAction(document, "save-and-compile")).toEqual({
      kind: "sequence",
      steps: [
        { kind: "save-local", text: "create package employees_api as procedure p; end;" },
        {
          kind: "compile",
          text: "create package employees_api as procedure p; end;",
          textSource: "saved-text",
          attachmentState: "attached",
          target: document.target,
          baselineFingerprints: { saved: "old", database: "db" },
          confirmAttach: false,
          confirmForce: false,
          confirmRecreate: false,
          confirmRetarget: false,
        },
      ],
    });
  });

  it("keeps mixed content on the ordinary SQL script path", () => {
    const document = createDatabaseSourceState({
      target: {
        connectionProfileId: "dev",
        workingSchema: "HR",
        owner: "HR",
        objectTypes: ["PACKAGE"],
        name: "EMPLOYEES_API",
      },
      savedText: "select * from employees;",
    });

    expect(planDatabaseSourceAction(document, "compile", { contentKind: "mixed" })).toEqual({
      kind: "run-as-sql-script",
      text: "select * from employees;",
    });
  });

  it("sets explicit confirmation flags for attach, force, recreate, and retarget", () => {
    const document = createDatabaseSourceState({
      target: {
        connectionProfileId: "dev",
        workingSchema: "HR",
        owner: "HR",
        objectTypes: ["PACKAGE"],
        name: "EMPLOYEES_API",
      },
      savedText: "create package employees_api as end;",
      attachmentState: "unconnected",
    });

    expect(planDatabaseSourceAction(document, "attach-and-compile")).toMatchObject({
      kind: "compile",
      confirmAttach: true,
    });
    expect(planDatabaseSourceAction(document, "force")).toMatchObject({
      kind: "compile",
      confirmForce: true,
    });
    expect(planDatabaseSourceAction(document, "recreate")).toMatchObject({
      kind: "compile",
      confirmRecreate: true,
    });
    expect(planDatabaseSourceAction(document, "retarget")).toMatchObject({
      kind: "compile",
      confirmRetarget: true,
    });
  });
});
