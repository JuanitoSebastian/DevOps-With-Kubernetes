#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MON_DIR="$DIR/manifests/monitoring"

echo "==> Adding Helm repositories"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

echo "==> Creating monitoring namespace (if not exists)"
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

echo "==> Installing Prometheus"
helm upgrade --install prom prometheus-community/prometheus \
  --namespace monitoring \
  --values "$MON_DIR/prom-values.yaml"

echo "==> Installing Loki"
helm upgrade --install loki grafana/loki \
  --namespace monitoring \
  --values "$MON_DIR/loki-values.yaml"

echo "==> Installing k8s-monitoring (Alloy log collector)"
helm upgrade --install k8smon grafana/k8s-monitoring \
  --namespace monitoring \
  --values "$MON_DIR/k8s-mon-values.yaml"

echo "==> Installing Grafana"
helm upgrade --install grafana grafana/grafana \
  --namespace monitoring \
  --values "$MON_DIR/grafana-values.yaml"

echo "==> Monitoring stack deployed successfully!"
echo "To check status: kubectl get pods -n monitoring"
echo "To open Grafana: kubectl port-forward --namespace monitoring svc/grafana 3000:80"
echo "                Open http://localhost:3000 (User: admin / Password: admin)"
