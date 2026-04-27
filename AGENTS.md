# AGENTS.md

## Repo shape
- Root is the Go backend. Main entrypoint is `cmd/main.go`.
- `web/` is a separate Vite + React app with its own `package.json` and `package-lock.json`. There is no root JS workspace.
- The live backend surface is small: `GET /health`, `POST /fetch/metadata/stream`, and `POST /download` in `internal/server/routes.go`.
- `internal/spotdl/` exists, but `cmd/main.go` wires only the `ytdlp` client into the server today. Do not assume `spotdl` code is active.

## Commands
- Backend dev: `go run ./cmd`
- Backend build: `go build ./cmd`
- Backend tests: `go test ./...`
- Focused Go test: `go test ./internal/ytdlp -run TestValidateContainerCodecs`
- Frontend dev: `npm run dev` from `web/`
- Frontend tests: `npm test` from `web/`
- Focused frontend test: `npx vitest run src/lib/media.test.ts` from `web/`
- Frontend production check: `npm run build` from `web/`.

## Verified workflow quirks
- The backend config in `internal/config/config.go` reads process env only. `go run ./cmd` does not load `.env` automatically.
- `docker compose` loads `.env`, but the compose file currently starts only the backend service. The `web` service is commented out.
- Local backend runs require `yt-dlp`, `ffmpeg`, and `ffprobe` on `PATH`; the Go code shells out to them directly. The root `Dockerfile` installs these tools.
- The frontend expects the backend at `http://localhost:8888` unless `VITE_API_BASE` is set. Vite proxies `/health`, `/fetch`, and `/download` in `web/vite.config.ts`.
- There is no verified frontend lint script or standalone typecheck script. `npm run build` is the current typecheck-equivalent because it runs `tsc -b && vite build`.

## Code hotspots
- `web/src/App.tsx` is the single-page UI entry and owns most fetch/download state.
- `web/src/lib/api.ts` is the frontend API contract, including SSE parsing for `/fetch/metadata/stream`.
- `web/src/lib/media.ts` contains the media selection rules and download request builders; most frontend tests target this file.
- Backend request validation and streaming/download handlers live in `internal/server/handlers.go`.
- Download conversion/remux behavior lives in `internal/ytdlp/download.go`; codec/container validation tests are in `internal/ytdlp/container_codecs_test.go`.

## Verification guidance
- Backend-only changes: run `go test ./...`.
- Frontend-only changes: run `npm test` in `web/`, then `npm run build` in `web/`.
- Changes that touch API payloads, routes, or download/format logic: run both Go tests and the frontend test/build checks.

## Avoid
- Do not edit `web/dist/` or `*.tsbuildinfo`; they are build artifacts and ignored.
- Do not rely on README examples that imply `.env` is picked up automatically for local `go run`; export vars in the shell or use Docker Compose.

## Tooling guidance
- Use codegraph for repository exploration, symbol relationships, and dependency tracing before broad text search when investigating unfamiliar areas.
- Prefer concise responses. Use caveman-style brevity for routine debugging, review, and implementation tasks unless the user asks for a detailed explanation.

## CodeGraph

CodeGraph builds a semantic knowledge graph of codebases for faster, smarter code exploration.

### If `.codegraph/` exists in the project

**NEVER call `codegraph_explore` or `codegraph_context` directly in the main session.** These tools return large amounts of source code that fills up main session context. Instead, ALWAYS spawn an Explore agent for any exploration question (e.g., "how does X work?", "explain the Y system", "where is Z implemented?").

**When spawning Explore agents**, include this instruction in the prompt:

> This project has CodeGraph initialized (.codegraph/ exists). Use `codegraph_explore` as your PRIMARY tool — it returns full source code sections from all relevant files in one call.
>
> **Rules:**
> 1. Follow the explore call budget in the `codegraph_explore` tool description — it scales automatically based on project size.
> 2. Do NOT re-read files that codegraph_explore already returned source code for. The source sections are complete and authoritative.
> 3. Only fall back to grep/glob/read for files listed under "Additional relevant files" if you need more detail, or if codegraph returned no results.

**The main session may only use these lightweight tools directly** (for targeted lookups before making edits, not for exploration):

| Tool | Use For |
|------|---------|
| `codegraph_search` | Find symbols by name |
| `codegraph_callers` / `codegraph_callees` | Trace call flow |
| `codegraph_impact` | Check what's affected before editing |
| `codegraph_node` | Get a single symbol's details |

### If `.codegraph/` does NOT exist

At the start of a session, ask the user if they'd like to initialize CodeGraph:

"I notice this project doesn't have CodeGraph initialized. Would you like me to run `codegraph init -i` to build a code knowledge graph?"