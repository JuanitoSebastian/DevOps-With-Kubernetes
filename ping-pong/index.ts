import { Context, Hono } from "hono";

const app = new Hono();
let count = 0;

const handlePingPong = (c: Context) => {
  const log = `pong ${count}`;
  count++;
  return c.text(log);
};

app.get("/pingpong", handlePingPong);
app.get("/", handlePingPong);

const port = Number(process.env.PORT) || 3000;

console.log(`Server started on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};