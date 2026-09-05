import { Hono } from "hono";

const app = new Hono();

const port = Number(process.env.PORT) || 3000;

app.get("/", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Todo App Server</title>
    </head>
    <body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
      <h1>Todo App Server</h1>
    </body>
    </html>
  `);
});

console.log(`Server started in port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
