import { Context, Hono } from "hono";
import { SQL } from "bun";

const app = new Hono();

const databaseUrl = process.env.DATABASE_URL!;

const db = new SQL(databaseUrl);

const ensureTable = async () => {
  let attempt = 1;
  while (true) {
    try {
      await db`CREATE TABLE IF NOT EXISTS pings (id int PRIMARY KEY, count int NOT NULL DEFAULT 0)`;
      console.log("Database table ready");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Database not ready (attempt ${attempt}): ${message}`);
      attempt++;
      await Bun.sleep(2000);
    }
  }
};

// Run in the background so the server starts listening immediately and
// only the readiness probe reports not-ready while the database is down.
void ensureTable();

const handlePingPong = async (c: Context) => {
  const [{ count }] = await db`
    INSERT INTO pings (id, count) VALUES (1, 1)
    ON CONFLICT (id) DO UPDATE SET count = pings.count + 1
    RETURNING count
  `;
  return c.text(`pong ${count}`);
};

const handlePings = async (c: Context) => {
  const [row] = await db`SELECT count FROM pings WHERE id = 1`;
  return c.text(`${row ? row.count : 0}`);
};

app.get("/pings", handlePings);
app.get("/", handlePingPong);

app.get("/healthz", async (c) => {
  try {
    await db`SELECT 1`;
    return c.text("ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Health check failed, database unreachable: ${message}`);
    return c.text("database unreachable", 500);
  }
});

const port = Number(process.env.PORT) || 3000;

console.log(`Server started on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
