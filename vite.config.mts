import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Dev-only middleware that serves the /api/* routes locally so the full app can
 * be tested end-to-end without deploying. Each route calls the SAME handler the
 * Vercel serverless function uses, compiled on the fly via Vite's SSR loader, so
 * dev and prod share one implementation. Server-side env (ANTHROPIC_API_KEY,
 * LIVEKIT_*) is loaded below and never sent to the client.
 */
function devApiPlugin(): Plugin {
  // route -> { module, export, fallback? }
  const routes: Record<string, { mod: string; fn: string; fallback?: string }> = {
    "/api/fable": { mod: "/src/server/fable.ts", fn: "handleFableRequest", fallback: "emergencyFallback" },
    "/api/token": { mod: "/src/server/token.ts", fn: "handleTokenRequest" },
  };

  return {
    name: "dev-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || "").split("?")[0];
        const route = routes[url];
        if (!route) return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "method_not_allowed" }));
          return;
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          const parsed = body ? safeParse(body) : {};
          try {
            const mod = await server.ssrLoadModule(route.mod);
            const result = await mod[route.fn](parsed);
            res.statusCode = result.status || 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(result.body));
          } catch (err) {
            // Handlers are supposed to never throw; this is the last-resort net.
            // eslint-disable-next-line no-console
            console.error(`[dev-api ${url}] unexpected error:`, err);
            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            try {
              if (route.fallback) {
                const mod = await server.ssrLoadModule(route.mod);
                res.end(JSON.stringify(await mod[route.fallback](parsed)));
              } else {
                res.end(JSON.stringify({ available: false, reason: "error" }));
              }
            } catch {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "fatal" }));
            }
          }
        });
      });
    },
  };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export default defineConfig(({ mode }) => {
  // Load .env into process.env so the dev middleware can read server-side keys.
  const env = loadEnv(mode, process.cwd(), "");
  for (const k of [
    "ANTHROPIC_API_KEY",
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "AGENT_NAME",
  ]) {
    if (env[k]) process.env[k] = env[k];
  }

  return {
    plugins: [react(), devApiPlugin()],
    server: { port: 5173, host: true },
    preview: { port: 4173, host: true },
    build: { outDir: "dist", sourcemap: false },
  };
});
