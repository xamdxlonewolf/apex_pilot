# Tauri e2e smoke (machine-local)

Apex Pilot keeps Vitest / jsdom for Console and MCP **presentation** paths.
This folder holds the lightest **Tauri-capable** smoke the repo sustains — not a
Playwright product suite and not figure pixel-match.

## What it covers

1. **Native shell** — `cargo check` on `src-tauri` (desktop shell compiles).
2. **MCP → Console migration** — source contracts that MCP Activity is hosted by
   the Developer Console tab, workspace feeds activity data, and the floating
   overlay is documented as interim-only.

## Prerequisites

- Node.js (same as frontend)
- Rust toolchain: `rustc` and `cargo` on `PATH`
- Cargo new enough for current crates (**edition2024** support — current stable
  Rust; Cargo 1.83 and older will skip `cargo check` with an explicit note while
  migration contracts still run)
- Platform deps for Tauri 2 (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

## CI policy (explicit gate)

| Condition | Behavior |
|-----------|----------|
| `TAURI_E2E` unset | **Skip** (exit 0), even if Rust is installed |
| `TAURI_E2E=0` | **Skip** (exit 0) |
| `TAURI_E2E=1` and Rust present | **Run** smoke |
| `TAURI_E2E=1` and Rust missing | **Fail** (exit 1) — opt-in must not silently pass |

Default `pnpm test` does **not** run this harness. CI stays on Vitest unless a
job sets `TAURI_E2E=1` on a machine with the native toolchain.

## Run

From `frontend/`:

```bash
# Skip / document gate (default)
pnpm test:e2e:tauri

# Machine-local opt-in
TAURI_E2E=1 pnpm test:e2e:tauri
```

## Out of scope

- Standalone Playwright product suites
- Figure / screenshot pixel-match
- Full WebDriver drives of the packaged app
