# Todo Backend

In-memory todo API built with **Bun** and **Hono**. Serves `GET/POST /todos` (also under `/api/todos`). No persistence — todos live in memory.

## Running locally

```bash
bun install
bun run index.ts
```

Listens on the `PORT` environment variable (default `3000`). Test it:

```bash
curl http://localhost:3000/todos
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"text":"Buy broccoli"}'
```

## Environment variables

| Variable | Default | Description         |
| :------- | :------ | :------------------ |
| `PORT`   | `3000`  | Server listen port  |

## Docker

```bash
docker build -t todo-backend .
```

## Kubernetes

Manifests for the whole app (backend + frontend + Ingress) live in [`../manifests/`](../manifests/).

```bash
kubectl apply -f ../manifests/
```

Verify inside the cluster:

```bash
kubectl run --rm -it debug --image=curlimages/curl --restart=Never -- \
  curl http://todo-backend-svc:2345/todos
```