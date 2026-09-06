# Todo App

Todo application built with **Bun**, **React**, **Tailwind CSS**, **shadcn/ui**, and **React Router**.

## Running locally

```bash
bun install
bun dev
```

`bun dev` starts the Bun server with hot reloading at http://localhost:3000.

To run for production:

```bash
bun build
bun start
```

The server listens on the `PORT` environment variable (default `3000`).

## Header image (Exercise 1.12)

The landing page shows a random image from [Lorem Picsum](https://picsum.photos/1200). The image
is cached on a persistent volume (mount path `/usr/src/todo-app/header-image`) and served from
`/header-image`. The cache refreshes when the stored image is older than 10 minutes — the filename
is a Unix epoch timestamp, so image age survives application restarts. When a new image is fetched,
any older cached images are pruned.

Environment variables:

| Variable               | Default                            | Description                                |
| :--------------------- | :--------------------------------- | :----------------------------------------- |
| `PORT`                 | `3000`                             | Server listen port                         |
| `HEADER_IMAGE_DIR`     | `/usr/src/todo-app/header-image`   | Persistent directory for cached images     |
| `IMAGE_MAX_AGE_MINUTES`| `10`                               | Max age of a cached image before refetch   |
| `HEADER_IMAGE_URL`     | `https://picsum.photos/1200`       | Image API to fetch from                    |

## Container Build

Build the Docker image:

```bash
docker build -t todo-app .
```

## Kubernetes Deployment

1. The cached header image uses a local PersistentVolume pinned to `k3d-k3s-default-agent-1`.
   The directory must exist on the node before the PV is bound:

   ```bash
   docker exec k3d-k3s-default-agent-1 mkdir -p /tmp/todo-image
   ```

2. Load the image into the k3d cluster:

   ```bash
   k3d image import todo-app:latest
   ```

3. Apply the manifests:

   ```bash
   kubectl apply -f manifests/
   ```

4. Access the application (e.g. via port-forward since no ingress hostname is set):

   ```bash
   kubectl port-forward service/todo-app-svc 8081:1234
   curl http://localhost:8081
   ```

   The cached image is available at `http://localhost:8081/header-image`. To verify the image
   survives a restart, delete the pod (`kubectl delete pod -l app=todo-app`) — the same image
   is served from the volume afterwards. To watch a refresh, lower `IMAGE_MAX_AGE_MINUTES` (e.g.
   `0.05`) in the deployment and re-request the endpoint.

## Stack

- **Bun** — runtime and bundler (`bun-plugin-tailwind` handles Tailwind in-tree)
- **React 19** — UI
- **React Router** — data router (route modules in `src/routes/`)
- **Tailwind CSS v4** + **shadcn/ui** — styling (`styles/globals.css`)

## Project structure

```text
src/
├── index.ts          # Bun HTTP server (serves the SPA + /header-image route)
├── header-image.ts   # Header image cache: fetch, freshness check, pruning
├── index.html        # HTML entry point
├── frontend.tsx      # React root rendering (RouterProvider)
├── router.tsx        # createBrowserRouter route definitions
└── routes/           # Route modules (components + async loaders)
```