#!/bin/bash
helm repo add nats https://nats-io.github.io/k8s/helm/charts/
helm repo update
helm upgrade --install my-nats nats/nats \
  --namespace nats --create-namespace \
  --set promExporter.enabled=true
