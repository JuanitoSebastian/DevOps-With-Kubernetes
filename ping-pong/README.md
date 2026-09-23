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

## GKE Deployment (Exercise 3.1)

Deploy ping-pong to Google Kubernetes Engine, exposed through a `LoadBalancer` service.

### 1. Push image to Google Artifact Registry
```bash
gcloud auth configure-docker --quiet
docker build -t ping-pong .
docker tag ping-pong gcr.io/<PROJECT-ID>/ping-pong
docker push gcr.io/<PROJECT-ID>/ping-pong
```

### 2. Apply manifests
```bash
kubectl create namespace exercises
kubectl apply -f manifests-gke/postgres/postgres-service.yaml \
              -f manifests-gke/postgres/postgres-statefulset.yaml \
              -f manifests-gke/ping-pong-deployment.yaml \
              -f manifests-gke/ping-pong-lb-service.yaml
```

GKE auto-provisions a Google Persistent Disk for the statefulset (no explicit `storageClassName`).

### 3. Get the external IP
```bash
kubectl get svc ping-pong-lb-svc -n exercises --watch   # External-IP column
```

### 4. Test
```bash
curl http://<EXTERNAL-IP>/        # -> pong 1, pong 2, ... (increments each hit)
curl http://<EXTERNAL-IP>/pings   # -> total count
```

Port mapping: LB `80` -> container `3000` (Layer 4 TCP forwarding).

## GKE Exposed via Ingress (Exercise 3.2)

Expose ping-pong together with log-output through a single GKE Ingress. Ping-pong answers from `/pingpong`; GKE also health-checks each backend on `/`, which the app answers with `200` (pong).

### Apply together with log-output (all in namespace `exercises`)

ping-pong side:
```bash
kubectl apply -f manifests-gke/postgres/postgres-service.yaml \
              -f manifests-gke/postgres/postgres-statefulset.yaml \
              -f manifests-gke/ping-pong-deployment.yaml \
              -f manifests-gke/ping-pong-nodeport-service.yaml
```

log-output side (see `log_output/README.md`): configmap, PVC, deployment, NodePort service, then the shared Ingress below.

### Ingress manifest (identical copy in both apps)
```bash
kubectl apply -f manifests-gke/ingress.yaml
```

### Get the external IP
```bash
kubectl get ing log-output-ingress   # watch until an IP is provisioned
```

### Test
```bash
curl http://<INGRESS-IP>/pingpong   # -> pong 1, pong 2, ...
curl http://<INGRESS-IP>/           # -> log-output page
```

GKE Ingress backends must be `type: NodePort` services. The health check hits `/` on both backends and expects HTTP 200.
