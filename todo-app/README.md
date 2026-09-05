# Todo App

## Development

To install dependencies:

```bash
bun install
```

To run locally:

```bash
bun run index.ts
```

## Container Build

Build the Docker image:

```bash
docker build -t todo-app .
```

## Kubernetes Deployment

1. Load image into k3d cluster:
   ```bash
   k3d image import todo-app:latest
   ```

2. Apply manifests:
   ```bash
   kubectl apply -f manifests/
   ```

3. Access application:
   ```bash
   curl http://localhost:8081
   ```
