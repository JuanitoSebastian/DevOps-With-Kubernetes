# Todo Frontend

React Router 8 SSR frontend (Bun + Vite, Tailwind CSS v4). Shows a random header image and the todo list fetched from the backend via `TODO_BACKEND_URL`.

## Running locally

```bash
bun install
cp .env.example .env   # one-time setup — Bun auto-loads it
bun dev
```

`bun dev` starts the dev server at http://localhost:3000 (`PORT` env). For production:

```bash
bun run build
bun run start
```

## Environment variables

Configuration is read once in `app/config.server.ts` — the single source of truth. Any missing or invalid required variable throws at import time: the frontend refuses to start with incomplete configuration. Only `PORT` may fall back.

| Variable              | Required | Default | Description                              |
| :-------------------- | :------- | :------ | :--------------------------------------- |
| `PORT`                | no       | `3000`  | Server listen port                       |
| `TODO_BACKEND_URL`    | **yes**  | —       | Base URL of the todo backend             |
| `HEADER_IMAGE_DIR`    | **yes**  | —       | Persistent directory for cached images   |
| `IMAGE_MAX_AGE_MINUTES` | **yes** (numeric) | — | Max age of a cached image before refetch |
| `HEADER_IMAGE_URL`    | **yes**  | —       | Image API to fetch from                  |

## Docker

```bash
docker build -t todo-frontend .
```

## Kubernetes

1. Create the host dir for the PV on the k3d node:

   ```bash
   docker exec k3d-k3s-default-agent-1 mkdir -p /tmp/todo-image
   ```

2. Build & import both images:

   ```bash
   docker build -t todo-frontend .   # in front/
   docker build -t todo-backend .    # in back/
   k3d image import todo-frontend:latest todo-backend:latest
   ```

3. Apply the unified manifests (backend + frontend + Ingress):

   ```bash
   kubectl apply -f ../manifests/
   ```

4. Access the app through the Ingress on port 80, or port-forward the frontend service:

   ```bash
   kubectl port-forward service/todo-frontend-svc 8081:1234
   curl http://localhost:8081
   curl http://localhost:8081/header-image
   ```

   Todos are fetched from the backend during SSR and POSTed to `/api/todos` (routed by the Ingress). The cached image survives pod restarts; lower `IMAGE_MAX_AGE_MINUTES` (e.g. `0.05`) to watch a refresh.