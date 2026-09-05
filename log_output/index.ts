import { Hono } from "hono";

const app = new Hono();
const randomString = crypto.randomUUID();

function outputLog() {
  const log = `${new Date().toISOString()}: ${randomString}`;
  console.log(log);
  return log;
}

outputLog();
setInterval(outputLog, 5000);

app.get("/", (c) => {
  return c.text(outputLog());
});

const port = Number(process.env.PORT) || 3000;

console.log(`Server started in port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
