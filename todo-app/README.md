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

The `./scripts/build-and-apply.sh` script builds both images, imports them into k3d, applies the manifests (decrypting the secret via sops), and rolls the deployments:

```bash
./scripts/build-and-apply.sh
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

## GKE Deployment (Exercise 3.5)

Deploy the todo-app to Google Kubernetes Engine using Kustomize.

### Prerequisites

- `gcloud` authenticated (`gcloud auth login`) with the target project set.
- A cluster exists — create with [`../gke-scripts/start_cluster.sh`](../gke-scripts/start_cluster.sh).
- Gateway API enabled on the cluster — [`../gke-scripts/enable_gatewayapi.sh`](../gke-scripts/enable_gatewayapi.sh).

### Deploy

```bash
./scripts/deploy-gke.sh
```

The script builds the three images, tags and pushes them to Google Container Registry (`gcr.io/dwk-gke-509503/*`), fetches the GKE cluster credentials (`dwk-cluster` in `europe-north1-b`), applies the database secret (decrypted via sops + age), and applies all resources via Kustomize:

```bash
kubectl apply -k manifests-gke/
# or preview without applying:
kubectl kustomize manifests-gke/
```

The GKE manifests (`manifests-gke/`) are copies of `manifests/` adjusted for GKE — the k3d `manifests/` folder is left untouched. Differences:

- Images reference `gcr.io/dwk-gke-509503/<image>` — update the project ID if yours differs (or set `GKE_PROJECT` when running the script).
- No manual `PersistentVolume` (`pv.yaml`) — GKE auto-provisions storage from the `PersistentVolumeClaim` (`standard-rwo` for postgres).
- The frontend Deployment uses `strategy: Recreate` (its PVC is `ReadWriteOnce`).
- Routing uses the **Gateway API** (`todo-app-gateway` Gateway + `todo-app-route` HTTPRoute) instead of Ingress.

The SOPS-encrypted secret stays out of Kustomize (plain `kustomize build` cannot decrypt it); `scripts/deploy-gke.sh` applies it via `sops --decrypt … | kubectl apply -f -` as in the k3d flow.

### Exposing the app

The Gateway provisions a cloud load balancer. Get its external IP:

```bash
kubectl get gateway todo-app-gateway -n project
curl http://<EXTERNAL-IP>/          # frontend
curl http://<EXTERNAL-IP>/api/todos # backend
```

## Automatic deployment (Exercise 3.6)

Pushes to `main` deploy the project automatically via GitHub Actions ([`.github/workflows/main.yaml`](../.github/workflows/main.yaml)):

1. **Authenticate** to GCP with Workload Identity Federation (keyless OIDC, no service-account keys).
2. **Build** the three images (`todo-frontend`, `todo-backend`, `create-wiki-todo-job`) tagged `europe-north1-docker.pkg.dev/dwk-gke-509503/my-repository/<image>:main-<sha>`.
3. **Push** them to Artifact Registry (`my-repository` in `europe-north1`).
4. **Deploy** with Kustomize: `kustomize edit set image …` rewrites the `gcr.io/dwk-gke-509503/*` image references to the freshly pushed tags, then `kustomize build . | kubectl apply -f -`, followed by `kubectl rollout status` for `todo-backend-dep` and `todo-frontend-dep`.

### One-time GCP setup

Run [`./scripts/setup-gcp-github-actions.sh`](./scripts/setup-gcp-github-actions.sh):

```bash
./scripts/setup-gcp-github-actions.sh
```

### GitHub secrets

| Secret | Description |
| :--- | :--- |
| `GKE_PROJECT` | GCP project ID |
| `SERVICE_ACCOUNT` | Service account email used by GitHub Actions |
| `WORKLOAD_IDENTITY_PROVIDER` | Full Workload Identity Provider resource name |

## Monitoring

The monitoring stack (Prometheus, Loki, Alloy, Grafana) is configured in [`manifests/monitoring/`](./manifests/monitoring/).

To install or update the monitoring stack:

```bash
./scripts/setup-monitoring.sh
```

To access Grafana:

```bash
kubectl port-forward --namespace monitoring svc/grafana 3000:80
# Open http://localhost:3000 (User: admin / Password: admin)
```
