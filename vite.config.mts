import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Dev-only middleware that serves POST /api/fable locally so the full kid loop
 * can be tested end-to-end without deploying. It calls the SAME handler the
 * Vercel serverless function uses (src/server/fable.ts), compiled on the fly via
 * Vite's SSR module loader. The handler reads ANTHROPIC_API_KEY from process.env
 * (loaded from .env below) — the key is never sent to the client.
 */
function fableApiPlugin(): Plugin {
  return {
    name: "dev-api-fable",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (url !== "/api/fable") return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "method_not_allowed" }));
          return;
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const mod = await server.ssrLoadModule("/src/server/fable.ts");
            const parsed = body ? JSON.parse(body) : {};
            const result = await mod.handleFableRequest(parsed);
            res.statusCode = result.status || 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(result.body));
          } catch (err) {
            // The handler is supposed to fall back internally and never throw.
            // This is the last-resort net so a child never sees an error.
            // eslint-disable-next-line no-console
            console.error("[dev-api-fable] unexpected error:", err);
            try {
              const mod = await server.ssrLoadModule("/src/server/fable.ts");
              const fallback = await mod.emergencyFallback(
                body ? safeParse(body) : {},
              );
              res.statusCode = 200;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify(fallback));
            } catch {
              res.statusCode = 500;
              res.setHeader("content-type", "application/json");
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
  // Load .env into process.env so the dev middleware can read ANTHROPIC_API_KEY.
  const env = loadEnv(mode, process.cwd(), "");
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

  return {
    plugins: [react(), fableApiPlugin()],
    server: { port: 5173, host: true },
    preview: { port: 4173, host: true },
    build: { outDir: "dist", sourcemap: false },
  };
});
