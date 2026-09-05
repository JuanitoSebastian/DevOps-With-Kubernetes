import { Hono } from "hono";

const app = new Hono();
const logFilePath = "/usr/src/app/files/log.txt";
const pingPongFilePath = "/usr/src/app/files/pingpong.txt";

app.get("/", async (c) => {
  let logContent = "";
  const logFile = Bun.file(logFilePath);
  if (await logFile.exists()) {
    logContent = await logFile.text();
  } else {
    logContent = "Log file not found";
  }

  let pongs = 0;
  const pingPongFile = Bun.file(pingPongFilePath);
  if (await pingPongFile.exists()) {
    const text = await pingPongFile.text();
    const parsed = parseInt(text.trim(), 10);
    if (!isNaN(parsed)) {
      pongs = parsed;
    }
  }

  return c.text(`${logContent}\nPing / Pongs: ${pongs}`);
});

const port = Number(process.env.PORT) || 3000;

console.log(`Server started in port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
