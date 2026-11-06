# knative — Exercise 5.6: Trying Serverless

Knative Serving experiment on a local k3d cluster: deploying a Knative Service (`ksvc`), observing scale-to-zero autoscaling, and splitting traffic between revisions.

Reference: [Knative docs](https://knative.dev/docs/) — [install-servicing-with-yaml](https://knative.dev/docs/install/yaml-install/serving/install-serving-with-yaml/) — [first-service](https://knative.dev/docs/getting-started/first-service/) — [first-autoscale](https://knative.dev/docs/getting-started/first-autoscale/) — [first-traffic-split](https://knative.dev/docs/getting-started/first-traffic-split/)

## Components

| Component | Purpose |
| :--- | :--- |
| Knative Serving v1.24.0 | Serverless runtime (ksvc → Revisions, scale-to-zero) |
| Kourier v1.24.0 | Lightweight Envoy-based ingress for Knative (port 80) |
| Magic DNS (sslip.io) | `default-domain` Job sets domain to `<LB-IP>.sslip.io` |

## Cluster (must be created without Traefik!)

```bash
k3d cluster create --port 8082:30080@agent:0 -p 8081:80@loadbalancer --agents 2 --k3s-arg "--disable=traefik@server:0" --image rancher/k3s:v1.34.1-k3s1
```

Traefik must be disabled so Kourier can bind to port 80 (mapped to host port 8081).

## Install Knative

```bash
# 1. Serving CRDs + core
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.24.0/serving-crds.yaml
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.24.0/serving-core.yaml

# 2. Kourier network layer + default ingress class
kubectl apply -f https://github.com/knative-extensions/net-kourier/releases/download/knative-v1.24.0/kourier.yaml
kubectl patch configmap/config-network --namespace knative-serving --type merge \
  --patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'

# 3. Magic DNS (sslip.io)
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.24.0/serving-default-domain.yaml
```

### K8s version guard fix

Knative v1.24.0 components crash-loop at startup with
`kubernetes version "1.34.1+k3s1" is not compatible, need at least "1.35.0-0"`.
Override the check (env var must be full semver — `1.34` fails to parse):

```bash
kubectl set env deployments --all KUBERNETES_MIN_VERSION=1.34.0 -n knative-serving
```

Notes:
- The `default-domain` Job fails while the webhook is down; re-create it (`kubectl delete job default-domain -n knative-serving && kubectl apply -f ...serving-default-domain.yaml`) after the core pods are `1/1 Running`. Job specs are immutable, so env vars cannot be patched in — it doesn't need the override anyway.
- The Envoy gateway (`3scale-kourier-gateway`) crash-loops while `net-kourier-controller` is down; delete its pod once the controller is up.

## Deploy the Knative Service

```bash
kubectl apply -f manifests/hello.yaml
kubectl get ksvc
# NAME    URL                                        READY
# hello   http://hello.default.172.18.0.3.sslip.io   True
```

## Test from the host machine

The k3d loadbalancer maps host port 8081 to Kourier's port 80:

```bash
curl -H "Host: hello.default.172.18.0.3.sslip.io" http://localhost:8081
# Hello World!
```

(Get the URL with `kubectl get ksvc`; the `<LB-IP>` in the domain is the Kourier
LoadBalancer IP: `kubectl get svc kourier -n kourier-system`.)

## Observe scale-to-zero

```bash
kubectl get pod -l serving.knative.dev/service=hello -w
```

- A pod runs for ~90 s after the last request, then scales to 0 (`No resources found`).
- The next `curl` wakes it up: the request is buffered by the activator while a fresh pod is created (~1–2 s).

## Traffic splitting

```bash
kubectl apply -f manifests/hello-v2.yaml          # TARGET="Knative" → new revision hello-00002
kubectl get revisions
curl -H "Host: hello.default.172.18.0.3.sslip.io" http://localhost:8081
# Hello Knative!

kubectl apply -f manifests/hello-traffic-split.yaml   # 50% latest (00002) / 50% hello-00001
for i in 1 2 3 4 5 6 7 8; do curl -s -H "Host: hello.default.172.18.0.3.sslip.io" http://localhost:8081; done
# Hello Knative!
# Hello World!
# Hello World!
# ...
```

Revisions are immutable snapshots; the split lives in `spec.traffic` of the `ksvc`
(`latestRevision: true` + `revisionName: hello-00001`, each 50%).
