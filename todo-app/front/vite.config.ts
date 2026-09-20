import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(async ({ command }) => {
  // Dev server only: validated app config (throws on missing envs).
  // Skipped during `react-router build`, which must run without envs.
  const { config } =
    command === "serve"
      ? await import("./app/config.server.ts")
      : { config: undefined };

  return {
    plugins: [reactRouter(), tailwindcss()],
    resolve: {
      tsconfigPaths: true,
    },
    server: config
      ? {
          port: config.port,
          proxy: {
            "/api": {
              target: config.todoBackendUrl,
              changeOrigin: true,
            },
          },
        }
      : undefined,
  };
});
