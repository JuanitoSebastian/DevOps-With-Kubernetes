import {
  Item,
  ItemContent,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";

type Todo = { id: number; text: string };

type TodoListProps = {
  todos: Todo[];
};

export function TodoList({ todos }: TodoListProps) {
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
          <ItemContent>
            <ItemTitle>{todo.text}</ItemTitle>
          </ItemContent>
          <ItemSeparator />
        </Item>
      ))}
    </ItemGroup>
  );
}