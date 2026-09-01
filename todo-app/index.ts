import { Hono } from "hono";

const app = new Hono();

const port = Number(process.env.PORT) || 3000;

app.get("/", (c) => c.text("Todo App Server"));

console.log(`Server started in port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
