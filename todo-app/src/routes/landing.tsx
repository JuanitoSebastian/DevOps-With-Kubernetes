import { useLoaderData } from "react-router";

export async function loader() {
  return { app: "Todo App" };
}

export function Component() {
  const { app } = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <main className="grid min-h-screen">
      <h1 className="mt-8 text-center text-5xl font-extrabold tracking-tight">{app}</h1>
      <img src="/header-image" alt="Header" className="mx-auto mt-8 w-[400px] rounded-lg" />
    </main>
  );
}