import asyncio, os, wave, contextlib, aiohttp
from dotenv import load_dotenv
load_dotenv(".env")
from livekit.agents import inference

LINE = ("High on a moonlit branch, Maya the little crow held the very last warm loaf. "
        "Her tummy rumbled, and the night was quiet and cold. "
        "What will you do, Maya? Share the bread? Or keep it for yourself?")

# (filename, model, voice)  — warm/expressive storyteller candidates
CANDS = [
  ("01-Matilda-warm",      "elevenlabs/eleven_multilingual_v2", "XrExE9yKIg1WjnnlVkGX"),
  ("02-Dorothy-storyteller","elevenlabs/eleven_multilingual_v2", "ThT5KcBeYPX3keUQqHPh"),
  ("03-Sarah-soft",        "elevenlabs/eleven_multilingual_v2", "EXAVITQu4vr4xnSDxMaL"),
  ("04-Lily-britishwarm",  "elevenlabs/eleven_multilingual_v2", "pFZP5JQG7iQjIQuC4Bku"),
  ("05-Jessica-bright",    "elevenlabs/eleven_multilingual_v2", "cgSgspJ2msm6clMCkdW9"),
  ("06-Matilda-v3expressive","elevenlabs/eleven_v3",            "XrExE9yKIg1WjnnlVkGX"),
  ("07-Rime-arcana-luna",  "rime/arcana",                       "luna"),
  ("08-Inworld-Ashley",    "inworld/inworld-tts-1.5",           "Ashley"),
]
OUT="/tmp/voices"; os.makedirs(OUT, exist_ok=True)

async def gen(sess, name, model, voice):
    kw={"http_session":sess}
    if voice is not None: kw["voice"]=voice
    t=inference.TTS(model=model, **kw)
    buf=b""; sr=24000
    async for ev in t.synthesize(LINE):
        fr=getattr(ev,"frame",None)
        if fr is None: continue
        buf+=bytes(fr.data); sr=fr.sample_rate
    p=f"{OUT}/{name}.wav"
    with wave.open(p,"wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(buf)
    return len(buf), sr

async def main():
    async with aiohttp.ClientSession() as sess:
        for name,model,voice in CANDS:
            try:
                n,sr=await gen(sess,name,model,voice)
                print(f"OK   {name:26s} {n//1000:4d}KB {sr}Hz")
            except Exception as e:
                print(f"FAIL {name:26s} {type(e).__name__}: {str(e)[:70]}")
asyncio.run(main())
