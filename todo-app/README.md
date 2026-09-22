# Todo App

Three services:

- [`./front`](./front/) — React Router 8 SSR frontend (todo form, random header image). Fetches todos server-side from the backend via `TODO_BACKEND_URL`.
- [`./back`](./back/) — Bun + Hono backend. Todos are stored in PostgreSQL (`GET/POST /todos`, also under `/api/todos`).
- [`./jobs/CreateWikiTodoJob`](./jobs/CreateWikiTodoJob/) — Bun job (runs as a Kubernetes CronJob) that inserts a `Read <random Wikipedia article>` todo every hour.
- [`./manifests`](./manifests/) — Kubernetes manifests for all services, the ingress, the jobs, and the database.

## Running locally

```bash
# terminal 0 — local postgres
docker run -d --name todo-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=todos -p 5432:5432 postgres:18

# terminal 1 — backend
cd back && bun install && DB_HOST=localhost POSTGRES_PASSWORD=postgres bun run index.ts   # listens on :3000

# terminal 2 — frontend
cd front && bun install && cp .env.example .env && bun dev
```

## Kubernetes deployment

All project resources live in the `project` namespace. The database is a **StatefulSet** (`todo-db-ss`, 1 replica, `postgres:18`) fronted by a headless Service (`todo-db-svc`). The backend gets its database config from the `todo-db-config` **ConfigMap** and the password from the `todo-db-secret` **Secret** (stored encrypted with SOPS + age — see [`manifests/postgres/`](./manifests/postgres/)).

A **CronJob** (`create-wiki-todo`, schedule `0 * * * *`) runs every hour and inserts a new todo `Read <URL>` where `<URL>` is a random Wikipedia article (fetched via `en.wikipedia.org/wiki/Special:Random`). It gets its database credentials from the same ConfigMap/Secret.

The `./build-and-apply.sh` script builds both images, imports them into k3d, applies the manifests (decrypting the secret via sops), and rolls the deployments:

```bash
./build-and-apply.sh
```

Useful commands:

```bash
kubectl get all -n project        # pods, services, deployments
kubectl get statefulsets -n project
kubectl logs -n project todo-db-ss-0
kubectl logs -n project deploy/todo-frontend-dep
kubectl get pvc -n project        # todo-image-claim bound to todo-image-pv

# CronJob
kubectl get cronjobs -n project
kubectl get jobs -n project       # inspect runs of create-wiki-todo
kubectl logs -n project <job-pod> # see the created todo
kubectl create job --from=cronjob/create-wiki-todo create-wiki-todo-manual -n project  # run manually
```

### Managing the database secret

The encrypted secret is `manifests/postgres/todo-db-secret.enc.yaml`. Re-encrypt it after editing the plaintext version:

```bash
sops --encrypt \
  --age <age-public-key> \
  --encrypted-regex '^(data)$' \
  manifests/postgres/todo-db-secret.yaml > manifests/postgres/todo-db-secret.enc.yaml
```

Apply it to the cluster (never write plaintext to disk):

```bash
export SOPS_AGE_KEY_FILE="$PWD/key.txt"
sops --decrypt manifests/postgres/todo-db-secret.enc.yaml | kubectl apply -f -
```

`key.txt` is the private age keypair and is gitignored — do not commit it.

## Monitoring

The monitoring stack (Prometheus, Loki, Alloy, Grafana) is configured in [`manifests/monitoring/`](./manifests/monitoring/).

To install or update the monitoring stack:

```bash
./setup-monitoring.sh
```

To access Grafana:

```bash
kubectl port-forward --namespace monitoring svc/grafana 3000:80
# Open http://localhost:3000 (User: admin / Password: admin)
```