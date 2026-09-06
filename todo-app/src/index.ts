import { serve } from "bun";
import { handleHeaderImage } from "./header-image";

const production = process.env.NODE_ENV === "production";

const index = production
  ? (await import("../dist/index.html")).default
  : (await import("./index.html")).default;

const server = serve({
  port: Number(process.env.PORT) || 3000,
  routes: {
    "/header-image": handleHeaderImage,
    // Serve index.html for all unmatched routes (client-side routing).
    "/*": index,
  },

  development: !production && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);