# Log Output Application

## Service mesh deployment (Exercise 5.3, Istio ambient on k3d)

**Prerequisite:** Istio ambient (istiod, ztunnel, istio-cni), Kiali, Prometheus and the Gateway API CRDs are already installed on the cluster — see `bookinfo/README.md` and the Istio docs. This exercise does not install Istio itself.

Same app plus a new `greeter` service; the responder appends `greetings: ...` to `GET /`.
Namespace `exercises` must be enrolled in the mesh (`istio.io/dataplane-mode=ambient`,
`istio.io/use-waypoint=waypoint`) — done by `manifests-istio/namespace.yaml`.

```bash
# images (one-time per change)
cd writer && docker build -t log-output-writer:latest . && cd ..
cd responder && docker build -t log-output-responder:latest . && cd ..
cd greeter && docker build -t greeter:latest . && cd ..
docker pull postgres:18
k3d image import -c k3s-default log-output-writer:latest log-output-responder:latest greeter:latest postgres:18

# mesh + apps
kubectl apply -f manifests-istio/namespace.yaml
kubectl apply -f manifests-istio/waypoint.yaml
kubectl apply -f ../ping-pong/manifests-istio/
kubectl apply -f greeter/manifests/
kubectl apply -f manifests-istio/log-output.yaml -f manifests-istio/gateway.yaml
kubectl annotate gateway log-output-gateway -n exercises networking.istio.io/service-type=ClusterIP
kubectl get pods -n exercises -w   # all Running
```

Access as in bookinfo:
```bash
kubectl port-forward -n exercises svc/log-output-gateway-istio 8080:80
curl localhost:8080/         # file content, MESSAGE, log line, pongs, greetings: Hello from version 1|2
curl localhost:8080/pingpong # pong N
```

Traffic split: `greeter/manifests/greeter-route.yaml` attaches an HTTPRoute to `greeter-svc`
(kind `Service`, `group: ""` — required, otherwise Istio ignores the route) and splits 75% to
`greeter-svc-1`, 25% to `greeter-svc-2`. Verify: `curl localhost:8080/ | grep greetings` in a
loop, and in Kiali (`istioctl dashboard kiali`) the exercises namespace graph shows the split.

## Kubernetes Deployment (GitOps / ArgoCD on GKE, Exercise 4.7)

Commits to `log_output/**` auto-deploy to GKE (`dwk-cluster`, namespace `exercises`) via pull-based GitOps. No `kubectl apply` for app updates, no image pull secret (nodes pull same-project GAR natively).

Prerequisites (one-time, GKE):
```bash
kubectl config use-context gke_dwk-gke-509503_europe-north1-b_dwk-cluster
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl create namespace exercises || true
```

Ping-pong dependency (one-time, out-of-band, NOT ArgoCD-managed — ping-pong gets no app):
```bash
# postgres + deployment + ClusterIP service into exercises, see ping-pong/README.md
# Required so PINGPONG_URL (http://ping-pong-svc:80/pings) resolves and /pingpong backend exists.
```

Register the app (tracks `main`):
```bash
kubectl apply -n argocd -f log_output/argocd/application.yaml
kubectl -n argocd get application log-output
```

Flow: commit to `log_output/**` on any branch → `.github/workflows/log-output-gitops.yaml`
builds/pushes `:$BRANCH-$SHA` images to `europe-north1-docker.pkg.dev/.../my-repository/log-output-*`,
updates `log_output/manifests-gke/kustomization.yaml` via `kustomize edit set image`, commits back →
ArgoCD auto-syncs (`prune:true, selfHeal:true`, ~3min poll) into `exercises`.
ArgoCD manages configmap, deployment, service, pvc, gateway (`app-gateway`) + httproute (`app-route`).
Coexists with todo-app: todo-app lives in `project` (or `$BRANCH`) ns behind `todo-app-gateway`; workflows are path-scoped (`todo-app/**` vs `log_output/**`).

Requires repo setting: GitHub Settings → Actions → General → Workflow permissions → Read and write.

ArgoCD UI:
```bash
kubectl -n argocd port-forward svc/argocd-server 8080:443
# user: admin, password:
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
```

Test:
```bash
kubectl get gateway app-gateway -n exercises   # watch ADDRESS column
curl http://<GATEWAY-IP>/           # -> log-output page, MESSAGE from configmap
curl http://<GATEWAY-IP>/pingpong   # -> pong N (routed to ping-pong)
```
Proof of GitOps: change `MESSAGE` in `log_output/manifests-gke/configmap.yaml`, push, wait for Actions green + ArgoCD sync (~3min), `curl` shows new value with no manual `kubectl apply`.

## Legacy local Deployment (pre-GitOps, k3d)

```bash
k3d image import log-output-writer log-output-responder
kubectl apply -f manifests/
```

## Legacy manual GKE Deployment (pre-GitOps, replaced by ArgoCD above)

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
