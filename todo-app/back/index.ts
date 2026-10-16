import { Hono } from "hono";
import { SQL } from "bun";

import { config } from "./config";
import { createTodoSchema, todoIdSchema, updateTodoSchema } from "./todos";

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
      SELECT id, title AS text, created_at, completed_at,
        (completed_at IS NOT NULL) AS completed
      FROM todos
      ORDER BY created_at DESC
    `;
    return c.json(rows);
  })
  .post("/todos", async (c) => {
    const body = await c.req.json();
    console.info(`Incoming todo: ${JSON.stringify(body)}`);
    const parsed = createTodoSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues }, 400);
    }
    const { text } = parsed.data;
    const [todo] = await db`
      INSERT INTO todos (title) VALUES (${text})
      RETURNING id, title AS text, created_at, completed_at,
        (completed_at IS NOT NULL) AS completed
    `;
    return c.json(todo, 201);
  })
  .put("/todos/:id", async (c) => {
    const id = c.req.param("id");
    if (!todoIdSchema.safeParse(id).success) {
      return c.json({ error: "invalid id" }, 400);
    }
    let completed: boolean;
    try {
      const body = await c.req.json();
      const parsed = updateTodoSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: parsed.error.issues }, 400);
      }
      completed = parsed.data.completed;
    } catch {
      return c.json({ error: "completed is required" }, 400);
    }
    try {
      const [todo] = await db`
        UPDATE todos
        SET completed_at = CASE WHEN ${completed} THEN now() ELSE NULL END
        WHERE id = ${id}
        RETURNING id, title AS text, created_at, completed_at,
          (completed_at IS NOT NULL) AS completed
      `;
      if (!todo) {
        return c.json({ error: "todo not found" }, 404);
      }
      return c.json(todo);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to update todo ${id}: ${message}`);
      return c.json({ error: "failed to update todo" }, 500);
    }
  });

app.route("/", todosApp);
app.route("/api", todosApp);

app.get("/healthz", async (c) => {
  try {
    await db`SELECT 1`;
    return c.json({ status: "ok" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Health check failed, database unreachable: ${message}`);
    return c.json({ status: "unhealthy" }, 500);
  }
});

app.get("/", (c) => c.text("TODO backend is running"));

const port = config.port;

console.log(`Server started on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};