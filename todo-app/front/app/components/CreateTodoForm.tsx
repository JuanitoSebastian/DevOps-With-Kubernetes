import { useState } from "react";
import { useRevalidator } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateTodoForm() {
  const [text, setText] = useState("");
  const { revalidate } = useRevalidator();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });

    if (res.ok) {
      setText("");
      revalidate();
    }
  }

  return (
    <form className="mx-auto mt-4 flex w-[400px] gap-2" onSubmit={handleSubmit}>
      <Input
        type="text"
        placeholder="New todo..."
        maxLength={140}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <Button type="submit">Send</Button>
    </form>
  );
}