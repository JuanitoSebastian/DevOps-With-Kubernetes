#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_ID="${GKE_PROJECT:-dwk-gke-509503}"
CLUSTER="${GKE_CLUSTER:-dwk-cluster}"
ZONE="${GKE_ZONE:-europe-north1-b}"

echo "==> Building images"
docker build -t todo-frontend "$DIR/front"
docker build -t todo-backend "$DIR/back"
docker build -t create-wiki-todo-job "$DIR/jobs/CreateWikiTodoJob"

echo "==> Tagging images for GCR (gcr.io/$PROJECT_ID)"
docker tag todo-frontend "gcr.io/$PROJECT_ID/todo-frontend"
docker tag todo-backend "gcr.io/$PROJECT_ID/todo-backend"
docker tag create-wiki-todo-job "gcr.io/$PROJECT_ID/create-wiki-todo-job"

echo "==> Authenticating Docker to GCR"
gcloud auth configure-docker --quiet

echo "==> Pushing images"
docker push "gcr.io/$PROJECT_ID/todo-frontend"
docker push "gcr.io/$PROJECT_ID/todo-backend"
docker push "gcr.io/$PROJECT_ID/create-wiki-todo-job"

echo "==> Getting GKE cluster credentials"
gcloud container clusters get-credentials "$CLUSTER" --zone "$ZONE" --project "$PROJECT_ID"

echo "==> Creating project namespace (if not exists)"
kubectl create namespace project --dry-run=client -o yaml | kubectl apply -f -

echo "==> Applying database secret (decrypted via sops + age)"
export SOPS_AGE_KEY_FILE="$DIR/key.txt"
sops --decrypt "$DIR/manifests/postgres/todo-db-secret.enc.yaml" | kubectl apply -f -

echo "==> Deploying resources via Kustomize"
kubectl apply -k "$DIR/manifests-gke"

echo "==> Done. Watching pod status... (Ctrl-C to stop)"
kubectl get pods -n project -w