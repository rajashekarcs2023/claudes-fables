// Source for the /api/token serverless function. Bundled by scripts/build-api.mjs
// into a self-contained api/token.js (livekit-server-sdk inlined). Logic lives
// in ./token so the dev middleware and the deployed function share one handler.

import { handleTokenRequest } from "./token";

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
    const result = await handleTokenRequest(body);
    res.status(result.status || 200).json(result.body);
  } catch (err) {
    // Never hard-fail — the client falls back to Web Speech narration.
    // eslint-disable-next-line no-console
    console.error("[/api/token] error:", err);
    res.status(200).json({ available: false, reason: "error" });
  }
}
