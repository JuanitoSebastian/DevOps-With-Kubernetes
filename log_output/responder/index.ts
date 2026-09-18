import { Hono } from "hono";

const app = new Hono();
const logFilePath = "/usr/src/app/files/log.txt";
const pingPongServiceUrl = process.env.PINGPONG_URL!;

app.get("/", async (c) => {
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

  return c.text(`${logContent}\nPing / Pongs: ${pongs}`);
});

const port = Number(process.env.PORT) || 3000;

console.log(`Server started in port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
