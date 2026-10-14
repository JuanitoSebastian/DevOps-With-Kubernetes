import { useEffect } from "react";
import { redirect, useNavigate } from "react-router";
import { breakApp, checkHealth } from "../health.server";

export async function action() {
  breakApp();
  return null;
}

export function loader() {
  if (checkHealth()) {
    throw redirect("/");
  }
  return null;
}

export default function Break() {
  const navigate = useNavigate();

  // Poll until a fresh (restarted) pod reports healthy, then return to the app.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/healthz");
        if (res.ok) {
          navigate("/");
        }
      } catch {
        // Pod still down or unhealthy — stay on the failure screen.
      }
    }, 3000);
    return () => clearInterval(id);
  }, [navigate]);

  return (
    <main className="grid min-h-screen place-items-center">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight">
          System Failure
        </h1>
        <p className="mt-4">Please wait...</p>
      </div>
    </main>
  );
}
