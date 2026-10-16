import { z } from "zod";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const BroadcasterModeSchema = z.enum(["forward", "log-only"]).default("forward");

export type BroadcasterMode = z.infer<typeof BroadcasterModeSchema>;

const parsedMode = BroadcasterModeSchema.safeParse(process.env.BROADCASTER_MODE);
if (!parsedMode.success) {
  throw new Error(
    `Invalid BROADCASTER_MODE: ${process.env.BROADCASTER_MODE} (expected "forward" | "log-only")`,
  );
}
const mode: BroadcasterMode = parsedMode.data;

export const config = {
  mode,
  nats: {
    url: requireEnv("NATS_URL"),
    subject: requireEnv("NATS_SUBJECT"),
  },
  telegram: {
    botToken: mode === "forward" ? requireEnv("TELEGRAM_BOT_TOKEN") : "",
    chatId: mode === "forward" ? requireEnv("TELEGRAM_CHAT_ID") : "",
  },
} as const;
