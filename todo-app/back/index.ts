import { Hono } from "hono";
import { SQL } from "bun";

import { config } from "./config";

const app = new Hono();

const db = new SQL(config.db);

const ensureTable = async () => {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await db`
        CREATE TABLE IF NOT EXISTS todos (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          title text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          completed_at timestamptz
        )
      `;
      console.log("Database table ready");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Database not ready (attempt ${attempt}/10): ${message}`);
      await Bun.sleep(2000);
    }
  }
  console.error("Could not initialize database table, exiting");
  process.exit(1);
};

await ensureTable();

const todosApp = new Hono()
  .get("/todos", async (c) => {
    const rows = await db`
      SELECT id, title AS text, created_at, completed_at
      FROM todos
      ORDER BY created_at DESC
    `;
    return c.json(rows);
  })
  .post("/todos", async (c) => {
    const body = await c.req.json();
    console.info(`Incoming todo: ${JSON.stringify(body)}`);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return c.json({ error: "text is required" }, 400);
    }
    if (text.length > 140) {
      console.error(`Todo is too long (${text.length} chars, max 140): ${text}`);
      return c.json({ error: "text must be at most 140 characters" }, 400);
    }
    const [todo] = await db`
      INSERT INTO todos (title) VALUES (${text})
      RETURNING id, title AS text, created_at, completed_at
    `;
    return c.json(todo, 201);
  });

app.route("/", todosApp);
app.route("/api", todosApp);

const port = config.port;

console.log(`Server started on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};