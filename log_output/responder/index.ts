import { Hono } from "hono";

const app = new Hono();
const logFilePath = "/usr/src/app/files/log.txt";
const configFilePath = "/usr/src/app/config/information.txt";
const pingPongServiceUrl = process.env.PINGPONG_URL!;
const message = process.env.MESSAGE;

app.get("/", async (c) => {
  let fileContent = "";
  const configFile = Bun.file(configFilePath);
  if (await configFile.exists()) {
    fileContent = (await configFile.text()).trim();
  } else {
    fileContent = "Config file not found";
  }

  let logContent = "";
  const logFile = Bun.file(logFilePath);
  if (await logFile.exists()) {
    logContent = await logFile.text();
  } else {
    logContent = "Log file not found";
  }

  let pongs = 0;
  try {
    const res = await fetch(pingPongServiceUrl);
    if (res.ok) {
      const text = await res.text();
      const parsed = parseInt(text.trim(), 10);
      if (!isNaN(parsed)) {
        pongs = parsed;
      }
    } else {
      console.error(`Failed to fetch pongs, status: ${res.status}`);
    }
  } catch (e) {
    console.error("Error fetching pongs from ping-pong service:", e);
  }

  return c.text(
    `file content: ${fileContent}\nenv variable: MESSAGE=${message}\n${logContent}\nPing / Pongs: ${pongs}`,
  );
});

app.get("/healthz", async (c) => {
  try {
    const res = await fetch(pingPongServiceUrl, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      return c.text("ok");
    }
    console.log(`Health check failed, ping-pong returned status: ${res.status}`);
    return c.text("ping-pong unreachable", 500);
  } catch (e) {
    console.error("Health check failed, error fetching pongs:", e);
    return c.text("ping-pong unreachable", 500);
  }
});

const port = Number(process.env.PORT) || 3000;

console.log(`Server started in port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
