# Todo Backend

Bun + Hono todo API backed by **PostgreSQL**. Serves `GET/POST /todos` (also under `/api/todos`). Todos are persisted in a PostgreSQL database (StatefulSet in Kubernetes).

Schema:

```sql
CREATE TABLE todos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
```

The JSON API keeps the field name `text` (mapped to the `title` column) so the frontend and existing clients are unaffected.

## Running locally

Requires a local PostgreSQL:

```bash
docker run -d --name todo-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=todos -p 5432:5432 postgres:18

DB_HOST=localhost DB_PORT=5432 POSTGRES_DB=todos POSTGRES_USER=postgres \
POSTGRES_PASSWORD=postgres bun run index.ts
```

Listens on the `PORT` environment variable (default `3000`). Test it:

```bash
curl http://localhost:3000/todos
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"text":"Buy broccoli"}'
```

## Environment variables

| Variable             | Default     | Description                             |
| :------------------- | :---------- | :-------------------------------------- |
| `PORT`               | `3000`      | Server listen port                      |
| `DB_HOST`            | `localhost` | Database host                          |
| `DB_PORT`            | `5432`      | Database port                          |
| `POSTGRES_DB`        | `todos`     | Database name                          |
| `POSTGRES_USER`      | `postgres`  | Database user                          |
| `POSTGRES_PASSWORD`  | `postgres`  | Database password                       |

In Kubernetes, `DB_HOST`, `DB_PORT`, `POSTGRES_DB`, and `POSTGRES_USER` come from the `todo-db-config` **ConfigMap** (also injected into the database StatefulSet), and `POSTGRES_PASSWORD` from the `todo-db-secret` **Secret**.

## Docker

```bash
docker build -t todo-backend .
```

## Kubernetes

Database resources (StatefulSet, headless Service, ConfigMap, Secret, check job) live in [`../manifests/postgres/`](../manifests/postgres/). The Secret is stored encrypted with [SOPS + age](../../README.md) in `todo-db-secret.enc.yaml`.

From the `todo-app/` directory:

```bash
# app manifests
kubectl apply -f manifests/ingress.yaml manifests/todo-backend-deployment.yaml
kubectl apply -f manifests/todo-backend-service.yaml

# database manifests
kubectl apply -f manifests/postgres/todo-db-configmap.yaml
kubectl apply -f manifests/postgres/todo-db-service.yaml
kubectl apply -f manifests/postgres/todo-db-statefulset.yaml

# encrypted secret (needs the local age key)
export SOPS_AGE_KEY_FILE="$PWD/key.txt"
sops --decrypt manifests/postgres/todo-db-secret.enc.yaml | kubectl apply -f -
```

Verify inside the cluster:

```bash
kubectl run --rm -it debug --image=curlimages/curl --restart=Never -- \
  curl -s http://todo-backend-svc:2345/todos
```

Restart the backend and confirm todos persist:

```bash
kubectl rollout restart -n project deployment/todo-backend-dep
```
