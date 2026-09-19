import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [reactRouter(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    proxy: {
      "/api": {
        target: process.env.TODO_BACKEND_URL ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});