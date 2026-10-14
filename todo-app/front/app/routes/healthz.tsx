import { checkHealth } from "../health.server";

export function loader() {
  if (!checkHealth()) {
    return Response.json({ status: "unhealthy" }, { status: 500 });
  }
  return Response.json({ status: "ok" });
}
