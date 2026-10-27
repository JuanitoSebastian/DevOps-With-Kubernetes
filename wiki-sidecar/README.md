# Wikipedia with init and sidecar (Exercise 5.4)

A single-Pod app that serves Wikipedia pages with nginx. Three containers share one `emptyDir` volume:

- **`init-fetch-kubernetes`** (init container, `curlimages/curl`) — fetches https://en.wikipedia.org/wiki/Kubernetes into `index.html`, then exits.
- **`nginx-server`** (main container, `nginx:alpine`) — serves the volume mounted at `/usr/share/nginx/html` on port 80.
- **`random-wiki-sidecar`** (sidecar, `curlimages/curl`) — sleeps a random 300–900 s (5–15 min), fetches https://en.wikipedia.org/wiki/Special:Random and replaces `index.html`, forever.

The page changes over time without rebuilding or restarting anything.

## Deploy

Requires a running cluster (built with k3d) and `kubectl` pointed at it.

```bash
kubectl create namespace exercises   # skip if it already exists
kubectl apply -f manifests/
```

## Verify

```bash
kubectl get pods -n exercises -l app=wikipedia -w
# Init:0/1 -> PodInitializing -> 2/2 Running

kubectl logs -n exercises deploy/wikipedia-dep -c init-fetch-kubernetes
# Fetched initial Kubernetes page

kubectl logs -n exercises deploy/wikipedia-dep -c random-wiki-sidecar
# Sleeping 619s before fetching a random Wikipedia page

kubectl port-forward -n exercises svc/wikipedia-svc 8080:80

curl -s localhost:8080 | grep -i "<title>"
# <title>Kubernetes - Wikipedia</title>
```

To see the sidecar swap the page without waiting up to 15 minutes, run its fetch by hand once, then re-check the title:

```bash
kubectl exec -n exercises deploy/wikipedia-dep -c random-wiki-sidecar -- \
  sh -c 'curl -sL https://en.wikipedia.org/wiki/Special:Random -o /shared/index.html.tmp && mv /shared/index.html.tmp /shared/index.html'

curl -s localhost:8080 | grep -i "<title>"
# <title>Peltogyne purpurea - Wikipedia</title>   (any random article)
```

## Cleanup

```bash
kubectl delete -f manifests/
```
