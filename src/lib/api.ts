// Client-side fetch for the kid's hot path. Defense in depth: even if the
// network fails or times out, we NEVER surface an error to a child — we fall
// back to the nearest pre-seeded demo, matching the server's own fallback.

import type { FableRequest, FableResponse } from "../types";
import { pickDemo } from "./demos";

const TIMEOUT_MS = 20000;

export async function requestFable(req: FableRequest): Promise<FableResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/fable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as FableResponse;
    if (!data || !data.fable || !data.fable.fork) throw new Error("malformed fable");
    return data;
  } catch (e) {
    return {
      fable: pickDemo(req.situation || "sharing", req.child_name, req.age_band),
      source: "fallback",
      fallback_reason: e instanceof Error ? e.message : "network",
    };
  } finally {
    clearTimeout(timer);
  }
}
