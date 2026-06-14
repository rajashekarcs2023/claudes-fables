"""Claude's Fables — the storyteller voice agent.

A LiveKit agent that is the warm *voice and ears* of the bedtime app. The web
app stays the brain (it generates the fable and runs the loop); this agent
narrates each line in a warm Cartesia voice and, at the fork, has a real little
two-way conversation: the child can SPEAK anything — pick a side, ask a question,
hesitate — and the storyteller replies warmly (a fast Claude turn), answers,
gently guides them, and reacts to their choice out loud. Tapping always works too.

Protocol over the LiveKit data channel (JSON), web -> agent:
    {"t":"say","id":"7","text":"High on a moonlit branch..."}   -> narrate it
    {"t":"listen","child_name":"Maya",
     "choices":[{"id":"share","label":"Share the bread","words":["share","bread"]},
                {"id":"keep","label":"Keep it for myself","words":["keep","mine"]}]}
    {"t":"chose","id":"share","label":"Share the bread"}        -> child tapped; ack it aloud
    {"t":"unlisten"}                                            -> leave the fork
    {"t":"stop"}                                                -> stop speaking now

agent -> web:
    {"t":"ready"}                      -> agent joined, session live
    {"t":"speaking","on":true|false}   -> drive the "reading to you" glow
    {"t":"say_done","id":"7"}          -> finished that line (web advances)
    {"t":"choice","id":"share"}        -> child SPOKE a choice (already acked aloud) -> branch
    {"t":"ack_done"}                   -> finished acknowledging a tapped choice -> branch

Speech runs through LiveKit Inference (Cartesia Sonic-3 TTS, Deepgram STT); the
warm conversational replies use Claude Haiku. Run: `uv run storyteller.py dev`.
"""

import asyncio
import contextlib
import json
import logging
import os
import random

import anthropic
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

load_dotenv(".env.local")
load_dotenv(".env")

logger = logging.getLogger("fable-teller")
logging.basicConfig(level=logging.INFO)

AGENT_NAME = os.getenv("AGENT_NAME", "fable-teller")
# A warm, expressive ElevenLabs voice for storytelling (far less robotic than a
# neutral business voice). Swap the voice id / model with FABLE_VOICE /
# FABLE_TTS_MODEL — run `uv run sample_voices.py` to audition options.
TTS_MODEL = os.getenv("FABLE_TTS_MODEL", "elevenlabs/eleven_multilingual_v2")
STT_MODEL = os.getenv("FABLE_STT_MODEL", "deepgram/nova-3")
STORYTELLER_VOICE = os.getenv("FABLE_VOICE", "XrExE9yKIg1WjnnlVkGX")  # ElevenLabs "Matilda" — warm
# Fast model for the warm conversational replies at the fork.
CONV_MODEL = os.getenv("FABLE_CONV_MODEL", "claude-haiku-4-5")

aclient = anthropic.AsyncAnthropic()  # reads ANTHROPIC_API_KEY

CONV_SYSTEM = (
    "You are a gentle, warm bedtime storyteller talking with a young child who is "
    "at a choice point in their own story. Speak in ONE short, soft sentence. Never "
    "lecture, never say which choice is the 'right' one, never mention being an AI or "
    "a model. If the child clearly picks one of the two options, set choice to that "
    "option's id and warmly acknowledge what they chose. If they say anything else (a "
    "question, a worry, a giggle, 'I don't know'), set choice to null, answer them "
    "gently in one sentence, and softly invite them to choose. "
    'Output ONLY strict JSON: {"choice": "<id or null>", "reply": "<one sentence>"}.'
)

server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


def _parse_json(text: str) -> dict | None:
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        t = t[t.find("{") :]
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1:
        return None
    with contextlib.suppress(Exception):
        return json.loads(t[start : end + 1])
    return None


def _keyword_choice(transcript: str, choices: list) -> str | None:
    text = transcript.lower()
    for c in choices:
        words = c.get("words") or [str(c.get("label", "")).lower()]
        if any(w and w in text for w in words):
            return c.get("id")
    return None


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    # AgentSession is the mouth (Cartesia TTS) and ears (Deepgram STT). It has no
    # auto-LLM — narration is exact lines the web app sends; the warm fork replies
    # are generated on demand by Claude (below), so the agent never improvises the
    # story itself.
    session = AgentSession(
        tts=inference.TTS(model=TTS_MODEL, voice=STORYTELLER_VOICE),
        stt=inference.STT(model=STT_MODEL),
        vad=ctx.proc.userdata["vad"],
    )

    state: dict = {"choices": None, "child_name": "little one", "busy": False}

    async def publish(msg: dict) -> None:
        with contextlib.suppress(Exception):
            await ctx.room.local_participant.publish_data(
                json.dumps(msg).encode("utf-8"), reliable=True
            )

    async def speak(text: str) -> None:
        if not text:
            return
        await publish({"t": "speaking", "on": True})
        try:
            handle = session.say(text, allow_interruptions=True)
            await handle.wait_for_playout()
        except Exception:
            logger.exception("say failed")
        await publish({"t": "speaking", "on": False})

    async def converse(transcript: str) -> None:
        """The child spoke at the fork — reply warmly and detect any choice."""
        choices = state.get("choices")
        if not choices or state.get("busy"):
            return
        state["busy"] = True
        try:
            a, b = choices[0], choices[1]
            user = (
                f"Child's name: {state['child_name']}. "
                f"Choice A: id='{a['id']}' label='{a['label']}'. "
                f"Choice B: id='{b['id']}' label='{b['label']}'. "
                f'The child just said: "{transcript}".'
            )
            choice_id: str | None = None
            reply = ""
            try:
                msg = await aclient.messages.create(
                    model=CONV_MODEL,
                    max_tokens=160,
                    system=CONV_SYSTEM,
                    messages=[{"role": "user", "content": user}],
                )
                raw = "".join(b.text for b in msg.content if b.type == "text")
                parsed = _parse_json(raw) or {}
                reply = str(parsed.get("reply") or "").strip()
                ch = parsed.get("choice")
                if isinstance(ch, str) and ch in (a["id"], b["id"]):
                    choice_id = ch
            except Exception:
                logger.exception("converse LLM failed")

            # fallbacks so the fork never stalls
            if choice_id is None:
                choice_id = _keyword_choice(transcript, choices)
            if not reply:
                reply = (
                    "What a lovely choice." if choice_id else "Take your time — what would you like to do?"
                )

            await speak(reply)
            if choice_id:
                state["choices"] = None
                await publish({"t": "choice", "id": choice_id})
        finally:
            state["busy"] = False

    async def acknowledge(label: str) -> None:
        """The child TAPPED a choice — say a warm one-liner, then web plays the branch."""
        name = state.get("child_name") or "little one"
        ack = random.choice(
            [
                f"Mmm… {label.lower()}. Let's see what happens, {name}.",
                f"You chose to {label.lower()}. Let's find out together.",
                f"{name} chooses… {label.lower()}. Here we go.",
            ]
        )
        await speak(ack)
        await publish({"t": "ack_done"})

    async def handle(msg: dict) -> None:
        t = msg.get("t")
        if t == "say":
            await speak(msg.get("text", ""))
            await publish({"t": "say_done", "id": msg.get("id")})
        elif t == "listen":
            state["choices"] = msg.get("choices") or None
            if msg.get("child_name"):
                state["child_name"] = msg["child_name"]
        elif t == "chose":
            state["choices"] = None
            await acknowledge(str(msg.get("label", "")))
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
        try:
            if not getattr(ev, "is_final", False):
                return
            if not state.get("choices"):
                return
            text = (getattr(ev, "transcript", "") or "").strip()
            if len(text) < 2:
                return
            asyncio.create_task(converse(text))
        except Exception:
            logger.exception("transcript handling failed")

    with contextlib.suppress(Exception):
        session.on("user_input_transcribed", on_transcript)

    await session.start(
        agent=Agent(
            instructions=(
                "You are a gentle bedtime storyteller. Speak only when given words "
                "to say. Be warm, calm, and brief."
            )
        ),
        room=ctx.room,
    )
    await ctx.connect()
    await publish({"t": "ready"})
    logger.info("fable-teller ready in room %s", ctx.room.name)


if __name__ == "__main__":
    cli.run_app(server)
