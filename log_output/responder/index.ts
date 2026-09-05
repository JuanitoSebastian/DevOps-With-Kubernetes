import { Hono } from "hono";

const app = new Hono();
const filePath = "/usr/src/app/files/log.txt";

app.get("/", async (c) => {
  const file = Bun.file(filePath);
  if (await file.exists()) {
    const logContent = await file.text();
    return c.text(logContent);
  }
  return c.text("Log file not found", 404);
});

const port = Number(process.env.PORT) || 3000;

console.log(`Server started in port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
