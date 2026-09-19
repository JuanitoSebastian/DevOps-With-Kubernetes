# Todo App

Two services:

- [`./front`](./front/) — React Router 8 SSR frontend (todo form, random header image). Fetches todos server-side from the backend via `TODO_BACKEND_URL`.
- [`./back`](./back/) — Bun + Hono backend with in-memory todos (`GET/POST /todos`, also under `/api/todos`).
- [`./manifests`](./manifests/) — unified Kubernetes manifests for both services and the Ingress.

## Running locally

```bash
# terminal 1 — backend
cd back && bun install && bun run index.ts          # listens on :3000

# terminal 2 — frontend
cd front && bun install && TODO_BACKEND_URL=http://localhost:3000 bun dev
```

## Kubernetes deployment

The `./build-and-apply.sh` script builds both images, imports them into k3d, applies the manifests, and rolls the deployments:

```bash
./build-and-apply.sh
```
