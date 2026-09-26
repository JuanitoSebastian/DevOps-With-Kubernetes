# Log Output Application

## Kubernetes Deployment

```bash
k3d image import log-output-writer log-output-responder
kubectl apply -f manifests/
```

## GKE Deployment

Deploy log-output to Google Kubernetes Engine behind the Gateway API (alongside ping-pong).

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

Requires Gateway API on the cluster:
```bash
gcloud container clusters update dwk-cluster --location=europe-north1-b --gateway-api=standard
```

### 2. Apply manifests (namespace `exercises`)
```bash
kubectl create namespace exercises
kubectl apply -f manifests-gke/
```

Applies configmap, PVC, deployment, `ClusterIP` service, and the shared `Gateway` (`app-gateway`) + `HTTPRoute` (`app-route`) manifests.

> ping-pong side (postgres + deployment + `ClusterIP` service) must be deployed first so `PINGPONG_URL` (`http://ping-pong-svc:80/pings`) resolves — see `ping-pong/README.md`.

### 3. Get the Gateway external IP
```bash
kubectl get gateway app-gateway -n exercises   # watch ADDRESS column
```

### 4. Test
```bash
curl http://<GATEWAY-IP>/           # -> log-output page
curl http://<GATEWAY-IP>/pingpong   # -> pong N (routed to ping-pong)
```

`app-route` routes `/` -> `log-output-svc` and `/pingpong` -> `ping-pong-svc` (both `ClusterIP`). GKE health-checks each backend on `/` expecting HTTP 200.
