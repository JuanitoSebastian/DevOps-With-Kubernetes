# Log Output Application

## Kubernetes Deployment

```bash
k3d image import log-output-writer log-output-responder
kubectl apply -f manifests/
```

## GKE Deployment

Deploy log-output to Google Kubernetes Engine as an Ingress backend (alongside ping-pong).

### 1. Push images to Google Artifact Registry
```bash
gcloud auth configure-docker --quiet
cd responder && docker build -t log-output-responder . && cd ..
cd writer && docker build -t log-output-writer . && cd ..
docker tag log-output-responder gcr.io/<PROJECT-ID>/log-output-responder
docker tag log-output-writer gcr.io/<PROJECT-ID>/log-output-writer
docker push gcr.io/<PROJECT-ID>/log-output-responder gcr.io/<PROJECT-ID>/log-output-writer
```

Default manifests reference `gcr.io/dwk-gke-509503/...`; adjust if your project differs.

### 2. Apply manifests (namespace `exercises`)
```bash
kubectl create namespace exercises
kubectl apply -f manifests-gke/configmap.yaml \
              -f manifests-gke/pvc.yaml \
              -f manifests-gke/deployment.yaml \
              -f manifests-gke/service.yaml
```

The PVC omits `storageClassName`, so GKE auto-provisions a Google Persistent Disk.

> ping-pong side (postgres + deployment + NodePort service) must be deployed first so `PINGPONG_URL` (`http://ping-pong-svc:80/pings`) resolves — see `ping-pong/README.md`.

### 3. Apply shared Ingress
```bash
kubectl apply -f manifests-gke/ingress.yaml
kubectl get ing log-output-ingress   # watch until an external IP is provisioned
```

### 4. Test
```bash
curl http://<INGRESS-IP>/           # -> log-output page
curl http://<INGRESS-IP>/pingpong   # -> pong N (routed to ping-pong)
```

GKE probes every Ingress backend on `/` expecting HTTP 200; log-output answers on `/`, so the health check passes.
