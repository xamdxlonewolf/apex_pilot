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

## Backend Health Configuration

The placeholder shell can check the FastAPI `/health` endpoint when a backend URL
is configured. Development can use Vite environment variables:

```powershell
$env:VITE_APEX_PILOT_BACKEND_URL = "http://127.0.0.1:8000"
$env:VITE_APEX_PILOT_BACKEND_TOKEN = "dev-token"
pnpm dev
```

Future Tauri sidecar work will inject the loopback backend URL and per-run bearer
token at runtime instead of relying on development environment variables.
