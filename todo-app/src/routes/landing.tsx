import { useLoaderData } from "react-router";

export async function loader() {
  return { app: "Todo App" };
}

export function Component() {
  const { app } = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <main className="grid min-h-screen place-items-center">
      <h1 className="text-5xl font-extrabold tracking-tight">{app}</h1>
    </main>
  );
}