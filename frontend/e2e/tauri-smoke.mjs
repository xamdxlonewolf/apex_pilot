#!/usr/bin/env node
/**
 * Light Tauri-capable e2e smoke for Apex Pilot.
 *
 * Default / CI: skip gracefully when TAURI_E2E is unset/0.
 * Machine-local: set TAURI_E2E=1 with Rust + Cargo to run.
 *
 * Covers:
 * 1) MCP → Developer Console migration contracts in product sources
 * 2) Native shell compile (`cargo check` on src-tauri) when the toolchain
 *    can resolve current crates (Cargo with edition2024 support)
 *
 * Not in scope: Playwright product suites, figure pixel-match, WebDriver UI.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriManifest = join(frontendRoot, "src-tauri", "Cargo.toml");
const tauriConf = join(frontendRoot, "src-tauri", "tauri.conf.json");

const log = (message) => {
  console.log(`[tauri-e2e] ${message}`);
};

const commandExists = (command) => {
  const probe = spawnSync(command, ["--version"], { encoding: "utf8" });
  return probe.status === 0;
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertSourceContains = (relativePath, needles, label) => {
  const absolute = join(frontendRoot, relativePath);
  assert(existsSync(absolute), `Missing ${relativePath}`);
  const source = readFileSync(absolute, "utf8");
  for (const needle of needles) {
    assert(
      source.includes(needle),
      `${label}: expected ${relativePath} to include ${JSON.stringify(needle)}`,
    );
  }
};

const shouldRun = () => {
  const flag = process.env.TAURI_E2E;
  if (flag === "0") {
    return { run: false, reason: "TAURI_E2E=0" };
  }
  const hasRust = commandExists("rustc") && commandExists("cargo");
  if (flag === "1") {
    if (!hasRust) {
      log("TAURI_E2E=1 but rustc/cargo are missing — failing closed.");
      process.exit(1);
    }
    return { run: true, reason: "TAURI_E2E=1" };
  }
  if (!hasRust) {
    return {
      run: false,
      reason: "native toolchain absent (set TAURI_E2E=1 when Rust/Cargo are installed)",
    };
  }
  return {
    run: false,
    reason: "toolchain present but TAURI_E2E unset (opt in with TAURI_E2E=1)",
  };
};

const runMigrationContracts = () => {
  log("MCP → Console migration contracts…");
  assertSourceContains(
    "src/DeveloperConsole.tsx",
    ["mcp-activity", "McpActivityPanel", "mcpFocusRequest"],
    "Developer Console hosts MCP Activity",
  );
  assertSourceContains(
    "src/IdeWorkspace.tsx",
    ["activityEntries", "mcpFocusRequest", "<DeveloperConsole"],
    "Workspace feeds MCP data into Console",
  );
  assertSourceContains(
    "src/App.tsx",
    ["showConsole: true", "setMcpFocusRequest", "openMcpActivityWindow"],
    "Product open path prefers Console; interim window retained",
  );
  assertSourceContains(
    "src/McpActivityWindow.tsx",
    ["Interim path", "Developer Console"],
    "Floating/overlay documents itself as interim",
  );
  assertSourceContains(
    "src/McpActivityPanel.tsx",
    ["ActivityTree", "Show all connections"],
    "Shared MCP panel feeds ActivityTree",
  );
  log("migration contracts passed");
};

const runCargoCheck = () => {
  assert(existsSync(tauriManifest), "src-tauri/Cargo.toml missing");
  assert(existsSync(tauriConf), "src-tauri/tauri.conf.json missing");
  const conf = JSON.parse(readFileSync(tauriConf, "utf8"));
  assert(conf?.app?.windows?.length >= 1, "tauri.conf.json must declare a main window");
  assert(conf.productName === "Apex Pilot", "unexpected productName in tauri.conf.json");

  log("cargo check (native shell)…");
  const result = spawnSync("cargo", ["check", "--manifest-path", tauriManifest], {
    cwd: frontendRoot,
    encoding: "utf8",
    env: process.env,
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status === 0) {
    log("cargo check passed");
    return;
  }

  const detail = `${result.stderr ?? ""}\n${result.stdout ?? ""}`;
  if (/edition2024/.test(detail) || /feature `edition2024` is required/.test(detail)) {
    log(
      "cargo check skipped: Cargo is too old for current crates (needs edition2024 / newer Rust).",
    );
    log("Install a current stable Rust toolchain, then re-run TAURI_E2E=1 pnpm test:e2e:tauri.");
    return;
  }
  process.exit(result.status ?? 1);
};

const gate = shouldRun();
if (!gate.run) {
  log(`skipped: ${gate.reason}`);
  log("See e2e/README.md for machine-local prerequisites.");
  process.exit(0);
}

log(`running (${gate.reason})`);
try {
  runMigrationContracts();
  runCargoCheck();
  log("smoke passed");
} catch (error) {
  console.error(`[tauri-e2e] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
