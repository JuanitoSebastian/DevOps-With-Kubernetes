import type { Route } from "./+types/landing";

export function loader(_args: Route.LoaderArgs) {
  return { app: "Todo App" };
}

export default function Landing({ loaderData }: Route.ComponentProps) {
  return (
    <main className="grid min-h-screen">
      <h1 className="mt-8 text-center text-5xl font-extrabold tracking-tight">{loaderData.app}</h1>
      <img src="/header-image" alt="Header" className="mx-auto mt-8 w-[400px] rounded-lg" />
    </main>
  );
}