# Ping-Pong Application

Ping-pong counter with persistent storage in a PostgreSQL database (StatefulSet).

## Build
```bash
docker build -t ping-pong .
```

## Kubernetes Deployment

### 1. PostgreSQL (StatefulSet)
```bash
kubectl apply -f manifests/postgres/postgres-service.yaml -f manifests/postgres/postgres-statefulset.yaml

# Verify statefulset & its auto-provisioned PVC
kubectl get statefulsets -n exercises
kubectl get pvc
```

Accessible at `postgres-svc:5432` (headless service), database `postgres`, user `postgres`, password `example`.

### 2. Verify DB connectivity (optional debug Job)
```bash
kubectl apply -f manifests/postgres/db-check-job.yaml
kubectl get jobs -n exercises          # expect Complete
kubectl logs -n exercises db-check-<pod> # expect "accepting connections" + "1"
```
