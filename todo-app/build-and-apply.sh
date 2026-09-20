#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Building images"
docker build -t todo-frontend "$DIR/front"
docker build -t todo-backend "$DIR/back"

echo "==> Importing images into k3d cluster"
k3d image import todo-frontend:latest todo-backend:latest

echo "==> Applying manifests"
kubectl apply -f "$DIR/manifests/"

echo "==> Rolling restart deployments"
kubectl rollout restart -n project deployment/todo-frontend-dep deployment/todo-backend-dep

echo "==> Done. Watching pod status... (Ctrl-C to stop)"
kubectl get pods -n project -w