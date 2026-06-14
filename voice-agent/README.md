# fable-teller — the storyteller voice agent

The warm *voice and ears* of Claude's Fables. A LiveKit agent that narrates each
line of the fable in a natural Cartesia voice (via LiveKit Inference) and, at the
fork, listens so the child can SPEAK their choice (tapping always works too).

The web app stays the brain — it generates the fable and runs the loop, sending
each line to this agent over the room data channel. See `storyteller.py` for the
tiny JSON protocol.

## Run it

```bash
cd voice-agent
cp .env.example .env        # paste your LIVEKIT_* keys (same project as the web app)
uv sync                     # installs livekit-agents + silero
uv run storyteller.py dev   # registers the agent and waits for rooms
```

Keep it running while you use the app. The web app's `/api/token` dispatches a
room to the agent named `AGENT_NAME` (`fable-teller`), so the names must match.

If LiveKit isn't running or configured, the web app silently falls back to the
browser's speechSynthesis — the story always has a voice.
