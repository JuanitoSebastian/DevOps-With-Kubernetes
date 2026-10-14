import { breakApp } from "../health.server";

export async function action() {
  breakApp();
  return null;
}

export default function Break() {
  return (
    <main className="grid min-h-screen place-items-center">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight">System Failure</h1>
        <p className="mt-4">Please wait...</p>
      </div>
    </main>
  );
}
