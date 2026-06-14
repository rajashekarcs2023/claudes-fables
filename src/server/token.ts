// POST /api/token — mint a short-lived LiveKit room token and dispatch the
// storyteller agent into the room. The frontend joins the room and the warm
// Cartesia voice narrates. If LiveKit isn't configured (no creds), we return
// { available: false } and the client silently falls back to Web Speech — the
// child is never left without a voice.
//
// Keys are read server-side only (Vercel env / dev middleware), never shipped.

import { AccessToken } from "livekit-server-sdk";
import { RoomConfiguration, RoomAgentDispatch } from "@livekit/protocol";

export interface TokenResult {
  available: boolean;
  reason?: string;
  serverUrl?: string;
  roomName?: string;
  participantToken?: string;
  agentName?: string;
}

function rand(): string {
  // no Date.now / Math.random restrictions here (server runtime) — fine to use.
  return Math.floor(Math.random() * 1e12).toString(36);
}

export async function handleTokenRequest(
  body: unknown,
): Promise<{ status: number; body: TokenResult }> {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  const agentName = process.env.AGENT_NAME || "fable-teller";

  if (!url || !key || !secret) {
    return { status: 200, body: { available: false, reason: "livekit_not_configured" } };
  }

  const b = (body || {}) as Record<string, unknown>;
  const childName =
    typeof b.child_name === "string" && b.child_name.trim()
      ? b.child_name.trim().slice(0, 24)
      : "Friend";
  const dispatchMeta = JSON.stringify({
    child_name: childName,
    situation: typeof b.situation === "string" ? b.situation.slice(0, 200) : "",
    age_band: b.age_band === "7-9" ? "7-9" : "4-6",
  });

  const roomName = `fable_${rand()}`;
  const identity = `child_${rand()}`;

  const at = new AccessToken(key, secret, { identity, name: "child", ttl: "20m" });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true, // the child may speak their choice
    canPublishData: true,
    canSubscribe: true,
  });

  // Explicitly dispatch the storyteller agent into this room.
  const rc = new RoomConfiguration();
  rc.agents.push(new RoomAgentDispatch({ agentName, metadata: dispatchMeta }));
  at.roomConfig = rc;

  const participantToken = await at.toJwt();

  return {
    status: 200,
    body: { available: true, serverUrl: url, roomName, participantToken, agentName },
  };
}
