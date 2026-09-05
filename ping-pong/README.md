# Ping-Pong Application

## Build
```bash
docker build -t ping-pong .
```

## Kubernetes Deployment
```bash
k3d image import ping-pong

kubectl apply -f manifests/
```
