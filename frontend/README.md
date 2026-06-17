# Apex Pilot Frontend

Tauri, React, and TypeScript desktop shell for Apex Pilot.

## Development

Install dependencies and run checks from this directory:

```powershell
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run the Vite development server:

```powershell
pnpm dev
```

Run the Tauri desktop shell:

```powershell
pnpm tauri dev
```

## Backend Configuration

The desktop shell can check backend health, list SQLcl saved connections, connect,
run a schema summary, and show MCP tool activity when a backend URL and bearer
token are configured. Development can use Vite environment variables:

```powershell
$env:VITE_APEX_PILOT_BACKEND_URL = "http://127.0.0.1:8000"
$env:VITE_APEX_PILOT_BACKEND_TOKEN = "dev-token"
pnpm dev
```

Tauri can also provide backend config at runtime through its `backend_config`
command. Packaged mode generates a per-run bearer token and can launch
`apex-pilot-api` as a sidecar when `APEX_PILOT_START_BACKEND_SIDECAR` is enabled
or debug assertions are disabled. Use `APEX_PILOT_BACKEND_COMMAND` to point the
sidecar launcher at a specific backend executable during packaging smoke tests.
