import { Context, Hono } from "hono";

const app = new Hono();
const filePath = "/usr/src/app/files/pingpong.txt";

let count = 0;

// Read existing count from volume on startup if available
async function initCount() {
  try {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const text = await file.text();
      const parsed = parseInt(text.trim(), 10);
      if (!isNaN(parsed)) {
        count = parsed;
      }
    }
  } catch (e) {
    console.error("Error reading initial count:", e);
  }
}
initCount();

const handlePingPong = async (c: Context) => {
  count++;
  try {
    await Bun.write(filePath, count.toString());
  } catch (e) {
    console.error("Error writing count to file:", e);
  }
  return c.text(`pong ${count}`);
};

app.get("/pingpong", handlePingPong);
app.get("/", handlePingPong);

const port = Number(process.env.PORT) || 3000;

console.log(`Server started on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};