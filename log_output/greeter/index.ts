import { Hono } from "hono";

const app = new Hono();
const message = process.env.MESSAGE;

app.get("/", (c) => c.text(message ?? "greeting not configured"));

const port = Number(process.env.PORT) || 3000;

console.log(`Server started in port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
