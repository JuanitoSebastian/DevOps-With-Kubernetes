import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/landing.tsx"),
  route("header-image", "routes/header-image.tsx"),
  route("healthz", "routes/healthz.tsx"),
  route("break", "routes/break.tsx"),
] satisfies RouteConfig;