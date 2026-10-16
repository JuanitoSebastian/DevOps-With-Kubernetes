# Broadcaster

Subscribes to NATS todo events and forwards them to **Telegram**. Scales horizontally without duplicates via a NATS **queue group** (all replicas share queue `broadcaster`, so each message is delivered to exactly one replica).

## Running locally

Requires NATS running locally:

```bash
docker run -d --name nats -p 4222:4222 nats:alpine
```

```bash
cd broadcaster && bun install && cp .env.example .env
NATS_URL=nats://localhost:4222 NATS_SUBJECT=todos \
TELEGRAM_BOT_TOKEN=<bot-token> TELEGRAM_CHAT_ID=<chat-id> \
bun run index.ts
```

Publish a test event:

```bash
bun -e "import { connect } from 'nats'; const nc = await connect({ servers: 'nats://localhost:4222' }); nc.publish('todos', new TextEncoder().encode(JSON.stringify({ event: 'created', id: '123e4567-e89b-12d3-a456-426614174000', text: 'Buy broccoli' }))); await nc.drain();"
```

The bot should send `New todo: Buy broccoli`.

## Environment variables

| Variable             | Description                              |
| :------------------- | :--------------------------------------- |
| `NATS_URL`           | NATS server URL (e.g. `nats://my-nats.nats.svc.cluster.local:4222`) |
| `NATS_SUBJECT`       | Subject to subscribe to (e.g. `todos`)   |
| `BROADCASTER_MODE`   | `forward` (default, sends to Telegram) or `log-only` (just logs, skips Telegram — used in staging) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (from BotFather). Required in `forward` mode, optional in `log-only` mode |
| `TELEGRAM_CHAT_ID`   | Telegram chat ID the messages go to. Required in `forward` mode, optional in `log-only` mode |

Missing `NATS_*` variables (or `TELEGRAM_*` in `forward` mode) throw `Missing required environment variable` on startup. An invalid `BROADCASTER_MODE` throws immediately.

## Docker

```bash
docker build -t broadcaster .
```

## Kubernetes (GKE)

Deployment `broadcaster-dep` (`manifests-gke/base/broadcaster-deployment.yaml`) runs **6 replicas**. Telegram credentials come from the SOPS-encrypted `broadcaster-secret.enc.yaml` Secret (applied per environment with `kubectl apply -n <env>`, outside ArgoCD):

```bash
export SOPS_AGE_KEY_FILE="$PWD/key.txt"
sops --decrypt manifests-gke/base/broadcaster-secret.enc.yaml | kubectl apply -n staging -f -
kubectl apply -k manifests-gke/overlays/staging/
kubectl get pods -n staging -l app=broadcaster
kubectl logs -n staging deploy/broadcaster-dep -f
```

The staging overlay patches in `BROADCASTER_MODE=log-only`, so staging pods log `LOG-ONLY (no forward): …` instead of calling Telegram. Production has no such patch and forwards normally.
