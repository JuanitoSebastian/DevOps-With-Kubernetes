# DummySite Controller

## Build

```bash
docker build -t dummy-site-controller .
k3d image import dummy-site-controller
```

## Kubernetes Deployment (local k3d)

Apply in this order (the graded workflow: RBAC → controller Deployment → DummySite):

```bash
kubectl apply -f manifests/crd.yaml
kubectl apply -f manifests/rbac.yaml
kubectl apply -f manifests/deployment.yaml
kubectl apply -f manifests/dummysite-example.yaml
```

## Test

```bash
kubectl get dummysites -n exercises        # URL printer column shows the target
kubectl logs -n exercises deploy/dummysite-controller -f

# View the cloned site:
kubectl port-forward -n exercises svc/example-site-svc 8080:80
curl http://localhost:8080                 # -> copy of https://example.com
```

Deleting the DummySite removes its ConfigMap, Deployment, and Service:

```bash
kubectl delete -f manifests/dummysite-example.yaml
kubectl get deploy,svc,cm -n exercises -l dummysite=example-site   # -> No resources found
```

## Local development (outside the cluster)

```bash
kubectl proxy --port=8001 &
KUBE_API_URL=http://localhost:8001/api \
KUBE_NAMESPACE=exercises \
bun run index.ts
```
(`kubectl proxy` handles auth, so no token or CA is needed.)
