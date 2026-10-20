import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vita's voice: Kokoro TTS (open-source, Apache-2.0) with the "af_heart" female
 * voice, run on the server with native multi-threaded ONNX. In the browser the
 * only shippable model size (q8, 92 MB) is single-threaded WASM and took ~17s
 * per sentence on an Intel Mac; here q4 does a sentence in ~2s and stays warm.
 */
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const VOICE = "af_heart";
const MAX_CHARS = 600;

type Kokoro = { generate(text: string, opts: { voice: "af_heart" }): Promise<{ toWav(): ArrayBuffer }> };

// One model per server process, shared by every request; a failed load is retried next time.
let model: Promise<Kokoro> | null = null;
function loadModel(): Promise<Kokoro> {
  model ??= import("kokoro-js")
    .then(({ KokoroTTS }) => KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q4", device: "cpu" }) as Promise<Kokoro>)
    .catch((err) => {
      model = null;
      throw err;
    });
  return model;
}

// Requests are serialized: concurrent ONNX runs on one model just fight over the same cores.
let chain: Promise<unknown> = Promise.resolve();
function generate(text: string): Promise<ArrayBuffer> {
  const run = chain.then(async () => (await (await loadModel()).generate(text, { voice: VOICE })).toWav());
  chain = run.catch(() => {});
  return run;
}

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

/** Warm-up: loads the model so Vita's first line isn't delayed. */
export async function GET() {
  if (!(await signedIn())) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  try {
    await loadModel();
    return NextResponse.json({ ready: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Voice model failed to load." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  if (!(await signedIn())) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
  if (!text) return NextResponse.json({ error: "text is required." }, { status: 400 });

  try {
    const wav = await generate(text);
    return new Response(wav, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Speech generation failed." }, { status: 503 });
  }
}
