// Source for the Vercel serverless function. It is bundled by
// scripts/build-api.mjs into a single self-contained file at api/fable.js
// (esbuild inlines the whole src import graph; only @anthropic-ai/sdk stays
// external and is resolved from node_modules on Vercel). This sidesteps
// Vercel's per-file TS transpile (which does NOT bundle cross-directory imports
// and otherwise fails with ERR_MODULE_NOT_FOUND).
//
// All real logic lives in ./fable so the dev middleware (vite.config.mts) and
// the deployed function share ONE handler. The ANTHROPIC_API_KEY is read
// server-side only, never shipped to the client.

import { handleFableRequest, emergencyFallback } from "./fable";

// Loosely typed to avoid a hard dependency on @vercel/node types.
interface VercelRequest {
  method?: string;
  body?: unknown;
}
interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (k: string, v: string) => void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  let body: unknown = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    body = {};
  }
  try {
    const result = await handleFableRequest(body);
    res.status(result.status || 200).json(result.body);
  } catch (err) {
    // A child must never see an error — fall back to a pre-seeded demo.
    // eslint-disable-next-line no-console
    console.error("[/api/fable] unexpected error:", err);
    res.status(200).json(emergencyFallback(body));
  }
}
