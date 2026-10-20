"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// ---------------------------------------------------------------- input --

// The Web Speech API's types aren't in lib.dom yet in most TS setups —
// this is the minimal shape we actually touch, kept local rather than `any`.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceInputSupported() {
  return getRecognitionCtor() !== null;
}

// ---------------------------------------------------------------- level --

// How loud the live voice is right now, 0..1 — the user's mic while listening,
// Vita's own audio while she talks. Read every animation frame by the mascot,
// so it's a plain getter rather than React state.
let voiceLevel = 0;
let audioCtx: AudioContext | null = null;

export function getVoiceLevel() {
  return voiceLevel;
}

/** Creates/resumes the shared AudioContext. Browsers only let it run after a user gesture, so call it from one. */
export function primeVoiceLevel() {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return;
  audioCtx ??= new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
}

function meter(analyser: AnalyserNode, isActive: () => boolean) {
  const data = new Uint8Array(analyser.fftSize);
  const tick = () => {
    if (!isActive()) {
      voiceLevel = 0;
      return;
    }
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) {
      const s = (v - 128) / 128;
      sum += s * s;
    }
    voiceLevel = Math.min(1, Math.sqrt(sum / data.length) * 5);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * Mic -> one utterance -> onFinal(text). Recognition stops itself after each
 * utterance, so it's never left open while Vita is talking (it would hear her).
 */
export function useSpeechInput(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported] = useState(isVoiceInputSupported);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText.trim()) {
        setInterim("");
        onFinalRef.current(finalText.trim());
      } else {
        setInterim(interimText);
      }
    };
    const ended = () => {
      listeningRef.current = false;
      setListening(false);
      setInterim("");
      releaseMicMeter(micStreamRef);
    };
    recognition.onend = ended;
    recognition.onerror = ended;

    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
      releaseMicMeter(micStreamRef);
    };
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || listeningRef.current) return;
    stopSpeaking(); // never listen over Vita's own voice
    try {
      recognition.start();
      listeningRef.current = true;
      setListening(true);
    } catch {
      // already starting — the browser will deliver onend/onresult as usual
      return;
    }
    // A second, metering-only tap on the mic so the mascot can pulse with the
    // user's voice. Best-effort: recognition works the same without it.
    primeVoiceLevel();
    const ctx = audioCtx;
    if (!ctx || !navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (!listeningRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        meter(analyser, () => listeningRef.current && micStreamRef.current === stream);
      })
      .catch(() => {});
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    listeningRef.current = false;
    setListening(false);
    setInterim("");
    releaseMicMeter(micStreamRef);
  }, []);

  const toggle = useCallback(() => (listeningRef.current ? stop() : start()), [start, stop]);

  return { listening, interim, start, stop, toggle, supported };
}

function releaseMicMeter(ref: { current: MediaStream | null }) {
  ref.current?.getTracks().forEach((t) => t.stop());
  ref.current = null;
}

// --------------------------------------------------------------- output --

/**
 * Vita has exactly one voice: Kokoro's natural female "af_heart", synthesized
 * on the server (/api/agent/tts, native ONNX — fast and nothing to download
 * in the browser). Lines queued while the model warms up wait for it rather
 * than switching voices mid-conversation. The browser's own female voice is
 * used only if the voice service can't be reached at all.
 */
const GENERATE_TIMEOUT_MS = 30_000;
const LOAD_WAIT_MS = 60_000;

export type VoiceEngine = "idle" | "loading" | "ready" | "fallback";

let engine: VoiceEngine = "idle";
const engineListeners = new Set<() => void>();
function setEngine(next: VoiceEngine) {
  if (engine === next) return;
  engine = next;
  engineListeners.forEach((l) => l());
}

let consecutiveFailures = 0;
let inflight: AbortController | null = null;

function giveUpOnKokoro(reason: unknown) {
  console.warn("Vita's voice service is unavailable; using the browser's female voice instead.", reason);
  setEngine("fallback");
}

/** Warms up Vita's voice on the server in the background; safe to call repeatedly. */
export function preloadVoice() {
  if (typeof window === "undefined" || engine !== "idle") return;
  setEngine("loading");
  fetch("/api/agent/tts", { signal: AbortSignal.timeout(LOAD_WAIT_MS * 2) })
    .then(async (res) => {
      if (res.ok) setEngine("ready");
      else if (res.status === 401) setEngine("idle"); // not signed in yet — try again on next use
      else giveUpOnKokoro(await res.text());
    })
    .catch(giveUpOnKokoro);
}

/** Resolves once the voice is usable (or definitively not), or after `ms`. */
function waitForEngine(ms: number): Promise<void> {
  if (engine === "ready" || engine === "fallback") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      engineListeners.delete(check);
      window.clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (engine === "ready" || engine === "fallback") done();
    };
    const timer = window.setTimeout(done, ms);
    engineListeners.add(check);
  });
}

function subscribeEngine(listener: () => void) {
  engineListeners.add(listener);
  return () => {
    engineListeners.delete(listener);
  };
}

/** "loading" while Vita's voice is still downloading (first use only — it's cached afterwards). */
export function useVoiceEngine() {
  return useSyncExternalStore(
    subscribeEngine,
    () => engine,
    () => "idle" as VoiceEngine,
  );
}

/** Kokoro audio for `text`, or null if this line couldn't be generated. */
async function synthesize(text: string): Promise<Blob | null> {
  if (engine !== "ready") return null;
  const controller = new AbortController();
  inflight = controller;
  const timer = window.setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);
  try {
    const res = await fetch("/api/agent/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
    if (inflight === controller) inflight = null;
  }
}

// Known female system-voice names, for the fallback voice.
const FEMALE_VOICE_NAMES =
  /samantha|victoria|allison|ava|susan|kate|serena|karen|moira|tessa|fiona|zira|jenny|aria|michelle|joanna|salli|kimberly|google us english|female/i;

// Chrome fills getVoices() asynchronously; an empty list on first call doesn't mean there are none.
function browserVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = window.speechSynthesis.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    window.setTimeout(done, 1500);
  });
}

async function pickFemaleVoice(): Promise<SpeechSynthesisVoice | undefined> {
  if (!("speechSynthesis" in window)) return undefined;
  const voices = await browserVoices();
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  return english.find((v) => FEMALE_VOICE_NAMES.test(v.name)) ?? voices.find((v) => FEMALE_VOICE_NAMES.test(v.name));
}

type SpeechItem = { text: string; droppable: boolean };

const queue: SpeechItem[] = [];
let workerRunning = false;
let epoch = 0; // bumps on stop, so in-flight work from before the stop discards itself
let currentAudio: HTMLAudioElement | null = null;
let finishCurrent: (() => void) | null = null;

let speaking = false;
const speakingListeners = new Set<() => void>();
function setSpeaking(value: boolean) {
  if (speaking === value) return;
  speaking = value;
  speakingListeners.forEach((l) => l());
}

function playBlob(blob: Blob): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(safety);
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      finishCurrent = null;
      resolve();
    };
    // Never let a stuck audio element keep Vita "speaking" forever.
    const safety = window.setTimeout(done, 30_000);
    finishCurrent = done;
    audio.onended = done;
    audio.onerror = done;
    // Route through an analyser so the mascot pulses with Vita's actual voice. Only when
    // the context is already running — a suspended one would silence the audio.
    if (audioCtx?.state === "running") {
      try {
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        audioCtx.createMediaElementSource(audio).connect(analyser);
        analyser.connect(audioCtx.destination);
        meter(analyser, () => !settled);
      } catch {
        // plays directly, just without metering
      }
    }
    audio.play().catch(done);
  });
}

async function speakWithBrowserVoice(text: string): Promise<void> {
  const voice = await pickFemaleVoice();
  // Female voice or nothing — never a random default voice.
  if (!voice) return;
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.04;
    utterance.voice = voice;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(safety);
      finishCurrent = null;
      resolve();
    };
    // Some engines (and voice-less environments) never fire onend; cap at a generous reading time.
    const safety = window.setTimeout(done, 2500 + text.length * 90);
    finishCurrent = done;
    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.speak(utterance);
  });
}

async function runWorker() {
  workerRunning = true;
  const myEpoch = epoch;
  setSpeaking(true);
  while (queue.length > 0 && epoch === myEpoch) {
    if (engine === "idle" || engine === "loading") {
      preloadVoice();
      // Hold the line until Vita's voice is warm (queued narration keeps getting replaced
      // by newer lines meanwhile, so nothing stale piles up). Still "speaking" — a reply
      // is pending — so the hands-free mic doesn't open and cut it off.
      await waitForEngine(LOAD_WAIT_MS);
      if (epoch !== myEpoch) return;
    }
    const item = queue.shift();
    if (!item) break;
    if (engine === "ready") {
      const blob = await synthesize(item.text);
      if (epoch !== myEpoch) return;
      if (blob) {
        consecutiveFailures = 0;
        await playBlob(blob);
      } else if (++consecutiveFailures >= 3) {
        giveUpOnKokoro("repeated generation failures");
      }
      // A single failed line is skipped rather than spoken in a different voice.
    } else if (engine === "fallback") {
      await speakWithBrowserVoice(item.text);
    }
    // Still downloading after the wait: drop this line; the text is on screen.
  }
  if (epoch === myEpoch) {
    workerRunning = false;
    setSpeaking(false);
  }
}

/**
 * Queues `text` to be spoken. `droppable` marks progress narration: if newer
 * narration arrives before it's spoken, the stale line is skipped so the
 * voice never lags behind what's on screen. `interrupt` cuts off anything
 * currently playing.
 */
export function speak(text: string, opts: { droppable?: boolean; interrupt?: boolean } = {}) {
  const clean = text.trim();
  if (!clean || typeof window === "undefined") return;
  if (opts.interrupt) stopSpeaking();
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].droppable) queue.splice(i, 1);
  queue.push({ text: clean, droppable: !!opts.droppable });
  if (!workerRunning) void runWorker();
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  epoch++;
  queue.length = 0;
  inflight?.abort();
  currentAudio?.pause();
  currentAudio = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  finishCurrent?.();
  workerRunning = false;
  setSpeaking(false);
}

function subscribeSpeaking(listener: () => void) {
  speakingListeners.add(listener);
  return () => {
    speakingListeners.delete(listener);
  };
}

export function useSpeechOutputStatus() {
  return useSyncExternalStore(
    subscribeSpeaking,
    () => speaking,
    () => false,
  );
}
