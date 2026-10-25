# Bookinfo

Follow these steps to set up the cluster and deploy the app.
Once everything is running here, continue with the Istio docs:
https://istio.io/latest/docs/ambient/getting-started/deploy-sample-app/

## 1. Create the cluster

```bash
k3d cluster create --api-port 6550 -p '9080:80@loadbalancer' -p '9443:443@loadbalancer' --agents 2 --k3s-arg '--disable=traefik@server:*'
```

## 2. Helm repo

Only needed once.

```bash
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update
```

## 3. Install the ambient profile

Four charts, in this order (order matters):

```bash
helm install istio-base istio/base -n istio-system --create-namespace --wait
helm install istiod istio/istiod --namespace istio-system --set profile=ambient --wait
# NOTE: do NOT use global.platform=k3d on recent k3s (v1.3x): it installs the binary in /bin,
# but k3s looks in /var/lib/rancher/k3s/data/cni -> ztunnel stuck in ContainerCreating
helm install istio-cni istio/cni -n istio-system --set profile=ambient \
  --set cni.cniBinDir=/var/lib/rancher/k3s/data/cni \
  --set cni.cniConfDir=/var/lib/rancher/k3s/agent/etc/cni/net.d --wait
helm install ztunnel istio/ztunnel -n istio-system --wait

kubectl get pods -n istio-system
# expect: istiod-xxx Running, ztunnel-xxx (×3), istio-cni-node-xxx (×3) — all 1/1
```

## 4. Gateway API CRDs

istioctl/istio charts never ship these:

```bash
kubectl get crd gateways.gateway.networking.k8s.io &> /dev/null || \
  { kubectl kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=v1.6.0" | kubectl apply -f -; }
```

## 5. Deploy Bookinfo

Explicitly into `default` (common namespace pitfall):

```bash
kubectl apply -f bookinfo/manifests/bookinfo.yaml -n default
kubectl apply -f bookinfo/manifests/bookinfo-versions.yaml -n default
kubectl get pods -w        # wait for all six Running (~1–2 min fresh cluster; image pulls)
```

## 6. Ingress gateway

```bash
kubectl apply -f bookinfo/manifests/bookinfo-gateway.yaml -n default
kubectl annotate gateway bookinfo-gateway networking.istio.io/service-type=ClusterIP
kubectl get gateway        # wait for PROGRAMMED=True
```

## 7. Access

```bash
kubectl port-forward svc/bookinfo-gateway-istio 8080:80
# browser → http://localhost:8080/productpage
```
