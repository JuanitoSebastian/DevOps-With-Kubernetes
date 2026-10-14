import { Form, redirect } from "react-router";
import { CreateTodoForm } from "@/components/CreateTodoForm";
import { TodoList } from "@/components/TodoList";
import { Button } from "@/components/ui/button";
import { checkHealth } from "../health.server";
import { config } from "../config.server";
import type { Route } from "./+types/landing";

type Todo = { id: number; text: string };

export async function loader(_args: Route.LoaderArgs) {
  if (!checkHealth()) {
    throw redirect("/break");
  }

  let todos: Todo[] = [];
  try {
    const res = await fetch(`${config.todoBackendUrl}/todos`);
    if (res.ok) {
      todos = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch todos:", error);
  }

  return {
    app: "Todo App",
    todos,
  };
}

export default function Landing({ loaderData }: Route.ComponentProps) {
  return (
    <main className="flex min-h-screen flex-col">
      <h1 className="mt-8 text-center text-5xl font-extrabold tracking-tight">{loaderData.app}</h1>
      <img src="/header-image" alt="Header" className="mx-auto mt-8 w-[400px] rounded-lg" />
      <CreateTodoForm />
      <TodoList todos={loaderData.todos} />
      <Form method="post" action="/break" className="mx-auto mt-auto mb-8 pt-8">
        <Button type="submit" variant="destructive">
          Break the app
        </Button>
      </Form>
    </main>
  );
}