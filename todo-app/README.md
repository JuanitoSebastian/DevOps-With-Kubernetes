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

## Container Build

Build the Docker image:

```bash
docker build -t todo-app .
```

## Kubernetes Deployment

1. Load the image into the k3d cluster:

   ```bash
   k3d image import todo-app:latest
   ```

2. Apply the manifests:

   ```bash
   kubectl apply -f manifests/
   ```

3. Access the application (e.g. via port-forward since no ingress hostname is set):

   ```bash
   kubectl port-forward service/todo-app-svc 8081:1234
   curl http://localhost:8081
   ```

## Stack

- **Bun** — runtime and bundler (`bun-plugin-tailwind` handles Tailwind in-tree)
- **React 19** — UI
- **React Router** — data router (route modules in `src/routes/`)
- **Tailwind CSS v4** + **shadcn/ui** — styling (`styles/globals.css`)

## Project structure

```text
src/
├── index.ts          # Bun HTTP server (serves the SPA for all routes)
├── index.html        # HTML entry point
├── frontend.tsx      # React root rendering (RouterProvider)
├── router.tsx        # createBrowserRouter route definitions
└── routes/           # Route modules (components + async loaders)
```