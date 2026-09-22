#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Building images"
docker build -t todo-frontend "$DIR/front"
docker build -t todo-backend "$DIR/back"

echo "==> Importing images into k3d cluster"
k3d image import todo-frontend:latest todo-backend:latest

echo "==> Applying manifests"
kubectl apply -f "$DIR/manifests/ingress.yaml"
kubectl apply -f "$DIR/manifests/pv.yaml"
kubectl apply -f "$DIR/manifests/pvc.yaml"
kubectl apply -f "$DIR/manifests/todo-backend-deployment.yaml"
kubectl apply -f "$DIR/manifests/todo-backend-service.yaml"
kubectl apply -f "$DIR/manifests/todo-frontend-deployment.yaml"
kubectl apply -f "$DIR/manifests/todo-frontend-service.yaml"

echo "==> Applying database manifests"
kubectl apply -f "$DIR/manifests/postgres/todo-db-configmap.yaml"
kubectl apply -f "$DIR/manifests/postgres/todo-db-service.yaml"
kubectl apply -f "$DIR/manifests/postgres/todo-db-statefulset.yaml"
kubectl apply -f "$DIR/manifests/postgres/db-check-job.yaml"

echo "==> Applying database secret (decrypted via sops + age)"
export SOPS_AGE_KEY_FILE="$DIR/key.txt"
sops --decrypt "$DIR/manifests/postgres/todo-db-secret.enc.yaml" | kubectl apply -f -

echo "==> Rolling restart deployments"
kubectl rollout restart -n project deployment/todo-frontend-dep deployment/todo-backend-dep

echo "==> Done. Watching pod status... (Ctrl-C to stop)"
kubectl get pods -n project -w