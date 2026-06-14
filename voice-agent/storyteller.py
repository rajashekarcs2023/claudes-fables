"""Claude's Fables — the storyteller voice agent.

A LiveKit agent that is the warm *voice and ears* of the bedtime app. The web
app stays the brain (it generates the fable and runs the 6-step loop); this
agent just narrates each line in a warm Cartesia voice and, at the fork, listens
so the child can SPEAK their choice (tapping always works too).

Protocol over the LiveKit data channel (JSON), child(web) -> agent:
    {"t":"say","id":"7","text":"High on a moonlit branch..."}  -> speak it
    {"t":"listen","choices":[{"id":"share","label":"Share the bread",
                              "words":["share","bread","give"]}, ...]}
    {"t":"unlisten"}            -> stop listening for a choice
    {"t":"stop"}               -> stop speaking now

agent -> child:
    {"t":"ready"}                      -> agent joined, session live
    {"t":"speaking","on":true|false}   -> drive the "reading to you" glow
    {"t":"say_done","id":"7"}          -> finished that line (web advances)
    {"t":"choice","id":"share"}        -> recognized a spoken choice
    {"t":"heard","text":"..."}         -> (debug) raw transcript

Speech runs through LiveKit Inference (Cartesia Sonic-3 TTS, Deepgram STT) so
the only secrets are the LIVEKIT_* keys. Run: `uv run storyteller.py dev`.
"""

import asyncio
import contextlib
import json
import logging
import os

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    inference,
)
from livekit.plugins import silero

# .env.local first (shared with the mossy agent), then .env
load_dotenv(".env.local")
load_dotenv(".env")

logger = logging.getLogger("fable-teller")
logging.basicConfig(level=logging.INFO)

AGENT_NAME = os.getenv("AGENT_NAME", "fable-teller")
TTS_MODEL = os.getenv("FABLE_TTS_MODEL", "cartesia/sonic-3")
STT_MODEL = os.getenv("FABLE_STT_MODEL", "deepgram/nova-3")
# A warm, gentle Cartesia voice. Override with FABLE_VOICE to taste.
STORYTELLER_VOICE = os.getenv("FABLE_VOICE", "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc")

server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    # No LLM: we never want the agent to improvise. It speaks ONLY the exact
    # lines the web app sends, and (best-effort) matches the child's spoken
    # choice. STT is for choice-matching only.
    session = AgentSession(
        tts=inference.TTS(model=TTS_MODEL, voice=STORYTELLER_VOICE),
        stt=inference.STT(model=STT_MODEL),
        vad=ctx.proc.userdata["vad"],
    )

    # current fork choices the child can speak; None when not at a fork
    state: dict = {"choices": None}

    async def publish(msg: dict) -> None:
        with contextlib.suppress(Exception):
            await ctx.room.local_participant.publish_data(
                json.dumps(msg).encode("utf-8"), reliable=True
            )

    async def speak(text: str, msg_id) -> None:
        if not text:
            await publish({"t": "say_done", "id": msg_id})
            return
        await publish({"t": "speaking", "on": True})
        try:
            handle = session.say(text, allow_interruptions=True)
            await handle.wait_for_playout()
        except Exception:
            logger.exception("say failed")
        await publish({"t": "speaking", "on": False})
        await publish({"t": "say_done", "id": msg_id})

    async def handle(msg: dict) -> None:
        t = msg.get("t")
        logger.debug("recv %s", t)
        if t == "say":
            await speak(msg.get("text", ""), msg.get("id"))
        elif t == "listen":
            state["choices"] = msg.get("choices") or None
        elif t == "unlisten":
            state["choices"] = None
        elif t == "stop":
            state["choices"] = None
            with contextlib.suppress(Exception):
                session.interrupt()

    def on_data(packet: rtc.DataPacket) -> None:
        try:
            msg = json.loads(bytes(packet.data).decode("utf-8"))
        except Exception:
            logger.exception("bad data packet")
            return
        asyncio.create_task(handle(msg))

    ctx.room.on("data_received", on_data)

    def on_transcript(ev) -> None:
        # Match the child's spoken words to a fork choice. Best-effort only —
        # tapping is always available in the UI.
        try:
            if not getattr(ev, "is_final", False):
                return
            choices = state.get("choices")
            if not choices:
                return
            text = (getattr(ev, "transcript", "") or "").lower()
            if not text:
                return
            asyncio.create_task(publish({"t": "heard", "text": text}))
            for c in choices:
                words = c.get("words") or [str(c.get("label", "")).lower()]
                if any(w and w in text for w in words):
                    state["choices"] = None
                    asyncio.create_task(publish({"t": "choice", "id": c["id"]}))
                    return
        except Exception:
            logger.exception("transcript handling failed")

    with contextlib.suppress(Exception):
        session.on("user_input_transcribed", on_transcript)

    await session.start(
        agent=Agent(
            instructions=(
                "You are a gentle bedtime storyteller. You only ever speak the "
                "exact words you are given; you never improvise or add commentary."
            )
        ),
        room=ctx.room,
    )
    await ctx.connect()
    await publish({"t": "ready"})
    logger.info("fable-teller ready in room %s", ctx.room.name)


if __name__ == "__main__":
    cli.run_app(server)
