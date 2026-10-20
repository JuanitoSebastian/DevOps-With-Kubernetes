#!/usr/bin/env bash
# Restores ArgoCD on a (re)created GKE cluster and re-registers the GitOps apps.
#
# Use after gke-scripts/start_cluster.sh (stop_cluster.sh DELETES the cluster,
# so ArgoCD + Application CRs + out-of-band secrets are all gone).
#
# What it does:
#   1. Fetches cluster credentials
#   2. Installs ArgoCD (argocd namespace + upstream install.yaml)
#   3. Re-applies Application manifests (todo-app staging/production + log_output)
#   4. Re-applies SOPS-encrypted secrets ArgoCD cannot manage
#      (todo-db-secret + broadcaster-telegram-secret into staging/production)
#
# Usage:
#   ./gke-scripts/setup_argocd.sh
#   GKE_PROJECT=<id> GKE_CLUSTER=dwk-cluster GKE_ZONE=europe-north1-b ./gke-scripts/setup_argocd.sh
#
# Requires: gcloud (authenticated), kubectl, sops, and todo-app/key.txt (age key, gitignored).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PROJECT_ID="${GKE_PROJECT:-dwk-gke-509503}"
CLUSTER="${GKE_CLUSTER:-dwk-cluster}"
ZONE="${GKE_ZONE:-europe-north1-b}"
SOPS_KEY_FILE="${SOPS_AGE_KEY_FILE:-$REPO_ROOT/todo-app/key.txt}"
# Sibling checkout of https://github.com/JuanitoSebastian/dwk-todo-app-config (Exercise 4.10)
CONFIG_REPO_DIR="${CONFIG_REPO_DIR:-$(cd "$REPO_ROOT/../dwk-todo-app-config" && pwd)}"

command -v kubectl >/dev/null || { echo "ERROR: kubectl not found" >&2; exit 1; }
command -v sops >/dev/null || { echo "ERROR: sops not found" >&2; exit 1; }

echo "==> Getting GKE cluster credentials ($CLUSTER, $ZONE, $PROJECT_ID)"
gcloud container clusters get-credentials "$CLUSTER" --zone "$ZONE" --project "$PROJECT_ID"

echo "==> Installing ArgoCD"
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

echo "==> Waiting for argocd-server to become available"
kubectl -n argocd wait --for=condition=available deployment/argocd-server --timeout=300s

echo "==> Registering ArgoCD applications (todo-app staging/production + log_output)"
kubectl apply -n argocd -f "$CONFIG_REPO_DIR/argocd/application-staging.yaml"
kubectl apply -n argocd -f "$CONFIG_REPO_DIR/argocd/application-production.yaml"
kubectl apply -n argocd -f "$REPO_ROOT/log_output/argocd/application.yaml"

echo "==> Creating app namespaces (if not exist)"
kubectl create namespace staging --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace production --dry-run=client -o yaml | kubectl apply -f -

echo "==> Applying out-of-band SOPS secrets (ArgoCD cannot decrypt these)"
if [[ -f "$SOPS_KEY_FILE" ]]; then
  export SOPS_AGE_KEY_FILE="$SOPS_KEY_FILE"
  sops --decrypt "$CONFIG_REPO_DIR/manifests/base/todo-db-secret.enc.yaml" | kubectl apply -n staging -f -
  sops --decrypt "$CONFIG_REPO_DIR/manifests/base/todo-db-secret.enc.yaml" | kubectl apply -n production -f -
  sops --decrypt "$CONFIG_REPO_DIR/manifests/base/broadcaster-secret.enc.yaml" | kubectl apply -n staging -f -
  sops --decrypt "$CONFIG_REPO_DIR/manifests/base/broadcaster-secret.enc.yaml" | kubectl apply -n production -f -
  sops --decrypt "$CONFIG_REPO_DIR/manifests/base/storage-sa-key.enc.yaml" | kubectl apply -n production -f -
else
  echo "WARNING: age key not found at $SOPS_KEY_FILE — skipping secret apply." >&2
  echo "WARNING: run GitHub Actions (push to main / push a tag) or apply manually once the key is present." >&2
fi

if kubectl -n production get secret storage-sa-key >/dev/null 2>&1; then
  echo "storage-sa-key present in production (todo-db-backup CronJob can authenticate)."
else
  echo "WARNING: secret storage-sa-key missing in production (needed by todo-db-backup CronJob)." >&2
  echo "WARNING: recreate it manually, e.g.:" >&2
  echo "  kubectl create secret generic storage-sa-key --from-file=key.json=/tmp/key.json -n production" >&2
fi

echo "==> Done. Current state:"
kubectl -n argocd get applications
kubectl -n argocd get pods

echo ""
echo "Next: ArgoCD syncs workloads from main automatically (~3min poll)."
echo "Todo-app also needs NATS + Gateway API on a fresh cluster:"
echo "  ./gke-scripts/enable_gatewayapi.sh"
echo "  ./gke-scripts/install_nats.sh"
