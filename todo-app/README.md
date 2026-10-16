# Todo App

Three services:

- [`./front`](./front/) — React Router 8 SSR frontend (todo form, random header image). Fetches todos server-side from the backend via `TODO_BACKEND_URL`.
- [`./back`](./back/) — Bun + Hono backend. Todos are stored in PostgreSQL (`GET/POST /todos`, also under `/api/todos`). Publishes `{event, id, text, completed}` to NATS on create/update.
- [`./broadcaster`](./broadcaster/) — Bun service (Exercise 4.6). Subscribes to NATS in queue group `broadcaster` and forwards todo events to Telegram. Runs 6 replicas, each message delivered once.
- [`./jobs/CreateWikiTodoJob`](./jobs/CreateWikiTodoJob/) — Bun job (runs as a Kubernetes CronJob) that inserts a `Read <random Wikipedia article>` todo every hour.
- [`./manifests`](./manifests/) — Kubernetes manifests for all services, the ingress, the jobs, and the database.

## Running locally

```bash
# terminal 0 — local postgres
docker run -d --name todo-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=todos -p 5432:5432 postgres:18

# terminal 1 — backend (needs DB_* + NATS_* — see back/.env.example)
cd back && bun install && cp .env.example .env && bun run index.ts   # listens on :3000

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
- NATS installed on the cluster — [`../gke-scripts/install_nats.sh`](../gke-scripts/install_nats.sh).

### Deploy

```bash
./scripts/deploy-gke.sh
```

The script builds the four images, tags and pushes them to Google Container Registry (`gcr.io/dwk-gke-509503/*`), fetches the GKE cluster credentials (`dwk-cluster` in `europe-north1-b`), applies the database secret (decrypted via sops + age), and applies all resources via Kustomize:

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

## Broadcaster

Async Telegram notifications via NATS. Flow: `todo-backend --publish (todos)--> NATS --queue subscribe--> broadcaster (x6) --sendMessage--> Telegram`. Requires NATS on the cluster ([`../gke-scripts/install_nats.sh`](../gke-scripts/install_nats.sh)).

## Automatic deployment (Exercise 3.6, GitOps since Exercise 4.8)

Pushes to `main` deploy the project automatically via pull-based GitOps (same pattern as `log_output` Exercise 4.7). GitHub Actions ([`.github/workflows/main.yaml`](../.github/workflows/main.yaml)) never runs `kubectl apply` for the app — ArgoCD does:

1. **Authenticate** to GCP with Workload Identity Federation (keyless OIDC, no service-account keys).
2. **Build** the four images (`todo-frontend`, `todo-backend`, `create-wiki-todo-job`, `broadcaster`) tagged `europe-north1-docker.pkg.dev/dwk-gke-509503/my-repository/<image>:main-<sha>`.
3. **Push** them to Artifact Registry (`my-repository` in `europe-north1`).
4. **Apply secrets outside ArgoCD** (ArgoCD cannot decrypt SOPS): `sops --decrypt … | kubectl apply -n project -f -` for `todo-db-secret` and `broadcaster-telegram-secret`. The `.enc.yaml` files stay out of `manifests-gke/kustomization.yaml` on purpose.
5. **Update manifests**: `kustomize edit set image PROJECT/…=$TAG` rewrites the `PROJECT/TODO-FRONTEND`, `PROJECT/TODO-BACKEND`, `PROJECT/BROADCASTER`, `PROJECT/CREATE-WIKI-TODO-JOB` placeholders in `manifests-gke/`, then commits `kustomization.yaml` back.
6. **ArgoCD syncs** `main:todo-app/manifests-gke` into namespace `project` (`prune:true, selfHeal:true`, ~3min poll, see [`argocd/application.yaml`](./argocd/application.yaml)).

Register the app once (ArgoCD already installed from Exercise 4.7):

```bash
kubectl config use-context gke_dwk-gke-509503_europe-north1-b_dwk-cluster
kubectl create namespace project || true
kubectl apply -n argocd -f todo-app/argocd/application.yaml
kubectl -n argocd get application todo-app
```

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

## Database backups (Exercise 3.10)

A **CronJob** (`todo-db-backup`, schedule `0 0 * * *`, GKE-only in
[`manifests-gke/postgres/todo-db-backup-cronjob.yaml`](./manifests-gke/postgres/todo-db-backup-cronjob.yaml))
dumps the `todos` database with `pg_dump` once per 24 hours and uploads
`backup-YYYY-MM-DD.sql` to the GCS bucket `juanito-dwk-todo-backups`.
The job runs the `google/cloud-sdk:alpine` image, installs
`postgresql-client` via apk, and authenticates with `gcloud auth
activate-service-account` using a GCP service-account key mounted from
the `storage-sa-key` Secret at `/etc/secrets/key.json`. DB credentials
come from the same `todo-db-config` ConfigMap / `todo-db-secret` Secret
as the rest of the app.

One-time setup (GCP service account + key, then the in-cluster secret —
never commit the key to GitHub):

```bash
gcloud storage buckets create gs://juanito-dwk-todo-backups --location=europe-north1
gcloud iam service-accounts create "todo-backup-sa" --display-name="Todo DB Backup SA"
gcloud projects add-iam-policy-binding <PROJECT_ID> --role="roles/storage.objectCreator" \
  --member="serviceAccount:todo-backup-sa@<PROJECT_ID>.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding <PROJECT_ID> --role="roles/storage.objectViewer" \
  --member="serviceAccount:todo-backup-sa@<PROJECT_ID>.iam.gserviceaccount.com"
gcloud iam service-accounts keys create /tmp/key.json \
  --iam-account=todo-backup-sa@<PROJECT_ID>.iam.gserviceaccount.com
kubectl create secret generic storage-sa-key --from-file=key.json=/tmp/key.json -n project
rm /tmp/key.json
```

Useful commands:

```bash
kubectl get cronjob todo-db-backup -n project
kubectl create job --from=cronjob/todo-db-backup backup-manual-1 -n project  # run now
kubectl logs job/backup-manual-1 -n project
gcloud storage ls -l gs://juanito-dwk-todo-backups/  # verify the backup landed
```

Note: the secret is created from the command line (per the exercise) and
is therefore not part of the GitHub Actions deployment — it must exist in
the `project` namespace for the backup pods to start.

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
