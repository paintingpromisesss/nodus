# nodus

## Run locally

Backend:

```bash
go run ./cmd
```

Web UI:

```bash
cd web
npm install
npm run dev
```

By default:

- backend: `http://localhost:8888`
- web: `http://localhost:5173`

Vite proxies `/health`, `/fetch/*`, and `/download` to the backend.

## Run with Docker Compose

```bash
docker compose up --build
```

Services:

- backend: `http://localhost:8888`
- web: `http://localhost:5173`
