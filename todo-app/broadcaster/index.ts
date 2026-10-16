import { connect, type NatsConnection } from "nats";

import { config } from "./config";
import { todoEventSchema, type TodoEvent } from "./events";

const QUEUE_GROUP = "broadcaster";

function formatMessage(event: TodoEvent): string {
  if (event.event === "created") {
    return `New todo: ${event.text}`;
  }
  return event.completed
    ? `Todo done: ${event.text}`
    : `Todo updated: ${event.text}`;
}

async function sendTelegram(text: string): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: config.telegram.chatId, text }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram API ${res.status}: ${body}`);
  }
}

async function run(nc: NatsConnection): Promise<void> {
  const sub = nc.subscribe(config.nats.subject, { queue: QUEUE_GROUP });
  console.log(
    `Broadcaster subscribed to "${config.nats.subject}" (queue "${QUEUE_GROUP}")`,
  );
  for await (const msg of sub) {
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(msg.data));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Dropping unparseable NATS message: ${message}`);
      continue;
    }
    const parsed = todoEventSchema.safeParse(payload);
    if (!parsed.success) {
      console.error(
        `Dropping invalid todo event: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      );
      continue;
    }
    const text = formatMessage(parsed.data);
    try {
      await sendTelegram(text);
      console.log(`Forwarded to Telegram: ${text}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to send Telegram message: ${message}`);
    }
  }
}

const nc = await connect({ servers: config.nats.url });
console.log(`Connected to NATS at ${config.nats.url}`);

const shutdown = async () => {
  console.log("Draining NATS connection...");
  try {
    await nc.drain();
  } catch {
    nc.close();
  }
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

await run(nc);
