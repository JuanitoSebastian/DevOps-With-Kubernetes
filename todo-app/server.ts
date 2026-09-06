import { serve } from "bun";
import { createRequire } from "node:module";
import { createRequestHandler } from "react-router";
import type { ServerBuild } from "react-router";

const require = createRequire(import.meta.url);
const build = require("./build/server/index.js") as ServerBuild;

const production = process.env.NODE_ENV === "production";

const server = serve({
  port: Number(process.env.PORT) || 3000,

  async fetch(request: Request) {
    const url = new URL(request.url);

    // Serve hashed static assets emitted by the client build.
    if (url.pathname.startsWith("/assets/")) {
      const file = Bun.file(`./build/client${url.pathname}`);
      if (await file.exists()) {
        return new Response(file);
      }
    }

    return createRequestHandler(build, "production")(request);
  },

  development: !production && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);