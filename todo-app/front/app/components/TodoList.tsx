import { useEffect, useRef, useState } from "react";
import { useRevalidator } from "react-router";
import { cn } from "cn";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Checkbox } from "@/components/ui/checkbox";
import { updateTodoSchema, type Todo } from "@/lib/todos";

type TodoListProps = {
  todos: Todo[];
};

export function TodoList({ todos: initialTodos }: TodoListProps) {
  const { revalidate } = useRevalidator();
  const [todos, setTodos] = useState(initialTodos);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setTodos(initialTodos);
  }, [initialTodos]);

  async function handleCheckedChange(todo: Todo, completed: boolean) {
    if (pendingRef.current.has(todo.id)) return;
    pendingRef.current.add(todo.id);

    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, completed } : t)),
    );

    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateTodoSchema.parse({ completed })),
      });
      if (!res.ok) {
        // Roll back optimistic update on failure.
        setTodos((prev) =>
          prev.map((t) =>
            t.id === todo.id ? { ...t, completed: todo.completed } : t,
          ),
        );
      } else {
        revalidate();
      }
    } catch {
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id ? { ...t, completed: todo.completed } : t,
        ),
      );
    } finally {
      pendingRef.current.delete(todo.id);
    }
  }

  if (todos.length === 0) {
    return (
      <p className="mx-auto mt-8 text-center text-muted-foreground">
        No todos yet.
      </p>
    );
  }

  return (
    <ItemGroup className="mx-auto mt-8 w-[400px]">
      {todos.map((todo) => (
        <Item key={todo.id}>
          <Checkbox
            checked={todo.completed}
            onCheckedChange={(value) =>
              handleCheckedChange(todo, value === true)
            }
            aria-label={`Mark "${todo.text}" as ${
              todo.completed ? "not completed" : "completed"
            }`}
          />
          <ItemContent>
            <ItemTitle
              className={cn(
                todo.completed && "text-muted-foreground line-through",
              )}
            >
              {todo.text}
            </ItemTitle>
          </ItemContent>
          <ItemSeparator />
        </Item>
      ))}
    </ItemGroup>
  );
}
