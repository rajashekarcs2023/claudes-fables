// Vercel serverless function: POST /api/fable.
// Thin adapter — all logic lives in src/server/fable.ts so the dev middleware
// (vite.config.ts) and this function share ONE handler. The ANTHROPIC_API_KEY
// is read server-side only, never shipped to the client.

import { handleFableRequest, emergencyFallback } from "../src/server/fable";

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
