# Create Wiki Todo Job

A minimal [Bun](https://bun.sh) job that runs as a Kubernetes **CronJob**. Every hour it fetches a random Wikipedia article via `https://en.wikipedia.org/wiki/Special:Random`, follows the redirect to the final article URL, and inserts a `Read <URL>` todo into the `todos` table.

Dependencies: none — uses only the Buntime and its built-in `bun:sql` (`import { SQL } from "bun"`).

## Running locally

Requires a local PostgreSQL (e.g. the `todo-pg` container from the main [`../README.md`](../README.md)):

```bash
DB_HOST=localhost DB_PORT=5432 POSTGRES_DB=todos POSTGRES_USER=postgres \
POSTGRES_PASSWORD=postgres bun run index.ts
```

Verify the new todo was created:

```bash
docker exec todo-pg psql -U postgres -d todos -c "SELECT title FROM todos ORDER BY created_at DESC"
```

## Environment variables

| Variable            | Description                          |
| :------------------ | :----------------------------------- |
| `DB_HOST`           | Database host                       |
| `DB_PORT`           | Database port (numeric)             |
| `POSTGRES_DB`       | Database name                       |
| `POSTGRES_USER`     | Database user                       |
| `POSTGRES_PASSWORD` | Database password                   |

In Kubernetes all of these come from the `todo-db-config` **ConfigMap** and `todo-db-secret` **Secret** via `envFrom` (see [`manifests/create-wiki-todo-cronjob.yaml`](../../manifests/create-wiki-todo-cronjob.yaml)).

## Docker

```bash
docker build -t create-wiki-todo-job .
```

## Kubernetes

The CronJob manifest is [`../../manifests/create-wiki-todo-cronjob.yaml`](../../manifests/create-wiki-todo-cronjob.yaml) (namespace `project`, schedule `0 * * * *`). Apply it from the `todo-app/` directory:

```bash
kubectl apply -f manifests/create-wiki-todo-cronjob.yaml
```

To trigger a run immediately instead of waiting for the hour:

```bash
kubectl create job --from=cronjob/create-wiki-todo create-wiki-todo-manual -n project
```

Inspect the run:

```bash
kubectl get jobs -n project
kubectl get pods -n project
kubectl logs -n project <job-pod>
```
