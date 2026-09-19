import { Hono } from "hono";

type Todo = { id: number; text: string };

let todos: Todo[] = [
  { id: 1, text: "Buy milk" },
  { id: 2, text: "Learn Kubernetes" },
  { id: 3, text: "Deploy todo app" },
];
let nextId = 4;

const app = new Hono();

const todosApp = new Hono()
  .get("/todos", (c) => c.json(todos))
  .post("/todos", async (c) => {
    const body = await c.req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return c.json({ error: "text is required" }, 400);
    }
    const todo: Todo = { id: nextId++, text };
    todos.push(todo);
    return c.json(todo, 201);
  });

app.route("/", todosApp);
app.route("/api", todosApp);

const port = Number(process.env.PORT) || 3000;

console.log(`Server started on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};