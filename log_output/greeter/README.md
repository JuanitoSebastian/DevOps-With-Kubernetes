# Greeter (Exercise 5.3)

Small Bun + Hono service that responds to `GET /` with `MESSAGE` (e.g. `Hello from version 1`).

The commands below assume you are in the repo root (`log_output/greeter` is this app).

## Build and run locally

```bash
bun install
MESSAGE="Hello from version 1" bun run index.ts   # port 3000 (override with PORT)
curl localhost:3000
```

Docker:

```bash
docker build -t greeter:latest .
docker run -e MESSAGE="Hello from version 1" -p 3000:3000 greeter:latest
```

Both versions (v1 and v2) run the same image; they only differ by the `MESSAGE` env var set
in `manifests/greeter-v1.yaml` and `manifests/greeter-v2.yaml`.

## Kubernetes (service mesh, exercise 5.3)

Requires Istio ambient (already installed on the cluster, see `bookinfo/README.md`) and the Gateway API CRDs.

```bash
docker build -t greeter:latest .
k3d image import -c k3s-default greeter:latest

kubectl apply -f log_output/greeter/manifests/greeter-v1.yaml
kubectl apply -f log_output/greeter/manifests/greeter-v2.yaml
kubectl apply -f log_output/greeter/manifests/greeter-route.yaml
```

Structure (3-service pattern):
- `greeter-svc` — selector-less frontend service; `log-output` calls it, and it is the
  parentRef target of the HTTPRoute (note: its Service parentRef must use `group: ""`,
  otherwise Istio does not attach the route).
- `greeter-svc-1`, `greeter-svc-2` — select `app: greeter` with `version: v1` / `v2`.
- `HTTPRoute greeter-split-route` — attached to `greeter-svc` (kind `Service`), splits
  traffic 75% to `greeter-svc-1` and 25% to `greeter-svc-2`.

Namespace must be enrolled in the mesh:
`kubectl label namespace exercises istio.io/dataplane-mode=ambient istio.io/use-waypoint=waypoint`
(see `log_output/manifests-istio/`).

## Verify

```bash
for i in {1..20}; do
  kubectl run -n exercises probe --image=curlimages/curl:8.16.0 --rm -q -i --restart=Never -- curl -s http://greeter-svc/
  echo
done | sort | uniq -c
# ~75% "Hello from version 1", ~25% "Hello from version 2"
```

Open Kiali with `istioctl dashboard kiali` — the graph shows log-output → greeter-svc,
split ~75/25 to greeter-svc-1 and greeter-svc-2.
