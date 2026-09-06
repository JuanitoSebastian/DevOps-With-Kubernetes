import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateTodoForm() {
  return (
    <form className="mx-auto mt-4 flex w-[400px] gap-2">
      <Input type="text" placeholder="New todo..." maxLength={140} />
      <Button type="submit">Send</Button>
    </form>
  );
}