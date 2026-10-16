import { connect, type NatsConnection } from "nats";

import { config } from "./config";

export type TodoEvent =
  | { event: "created"; id: string; text: string }
  | { event: "updated"; id: string; text: string; completed: boolean };

let nc: NatsConnection | null = null;
let connecting: Promise<NatsConnection | null> | null = null;

async function getConnection(): Promise<NatsConnection | null> {
  if (nc && !nc.isClosed()) {
    return nc;
  }
  if (!connecting) {
    connecting = connect({ servers: config.nats.url })
      .then((conn) => {
        nc = conn;
        console.log(`Connected to NATS at ${config.nats.url}`);
        return conn;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to connect to NATS: ${message}`);
        return null;
      })
      .finally(() => {
        // Allow retry on next publish if connection failed.
        if (!nc || nc.isClosed()) {
          connecting = null;
        }
      });
  }
  return connecting;
}

export function publishTodoEvent(payload: TodoEvent): void {
  void getConnection()
    .then((conn) => {
      if (!conn) {
        return;
      }
      conn.publish(
        config.nats.subject,
        new TextEncoder().encode(JSON.stringify(payload)),
      );
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to publish todo event: ${message}`);
    });
}
