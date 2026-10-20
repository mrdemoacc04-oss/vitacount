"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
  Mic,
  Plus,
  ShieldCheck,
  SkipForward,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Mascot } from "@/components/mascot";
import { preloadVoice, primeVoiceLevel, speak, stopSpeaking, useSpeechInput, useSpeechOutputStatus, useVoiceEngine } from "@/lib/agent/use-voice";
import { useVitaAgent, type LogItem } from "@/lib/agent/use-vita-agent";

type HistoryEntry = { id: string; title: string; items: LogItem[]; updatedAt: number };
type FabPos = { top: number; left: number };

const STARTERS = [
  "Open the dashboard",
  "Record a $45 office supplies expense I paid by card today",
  "Create an invoice for 3 hours of consulting at $150",
  "What's my net profit this month?",
];

const HISTORY_KEY = "vitacount-agent-history";
const HISTORY_LIMIT = 30;
const POS_KEY = "vitacount-agent-pos";
const GREETED_KEY = "vitacount-agent-greeted";
const FAB_SIZE = 64;
const DRAG_THRESHOLD = 6;

function newSessionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as (HistoryEntry & { messages?: { role: string; content: string }[] })[]) : [];
    // Older saves stored {role, content} messages; carry them over as user/Vita turns.
    return parsed.map((h) =>
      h.items
        ? h
        : {
            id: h.id,
            title: h.title,
            updatedAt: h.updatedAt,
            items: (h.messages ?? [])
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m, i): LogItem => ({ id: `${h.id}-${i}`, kind: m.role === "user" ? "user" : "vita", text: m.content })),
          },
    );
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // storage full or unavailable — history just won't persist this time
  }
}

function clampFabPos(top: number, left: number): FabPos {
  const margin = 4;
  return {
    top: Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - FAB_SIZE - margin)),
    left: Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - FAB_SIZE - margin)),
  };
}

const iconButton =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground";

export function AgentChat() {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sessionId, setSessionId] = useState(newSessionId);
  const [input, setInput] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  // Hands-free: the user is talking to Vita, so she listens again after each reply.
  const [handsFree, setHandsFree] = useState(false);
  // The user chose to look at the full panel even while Vita is live.
  const [panelPinned, setPanelPinned] = useState(false);
  const [fabPos, setFabPos] = useState<FabPos | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const armListenRef = useRef(false);
  const speaking = useSpeechOutputStatus();
  const voiceEngine = useVoiceEngine();

  const agent = useVitaAgent({
    onNarrate: (text) => {
      if (voiceOn) speak(text, { droppable: true });
    },
    onReply: (text) => {
      if (voiceOn) speak(text);
      armListenRef.current = handsFree;
    },
    onApprovalRequested: (summary) => {
      if (voiceOn) speak(`${summary}. Should I go ahead?`);
      armListenRef.current = handsFree;
    },
  });

  const mic = useSpeechInput((text) => submit(text, { viaVoice: true }));
  const { start: startMic, stop: stopMic } = mic;

  const pendingApproval = [...agent.log].reverse().find((i) => i.kind === "approval" && i.status === "pending") as
    | Extract<LogItem, { kind: "approval" }>
    | undefined;
  const lastReply = [...agent.log].reverse().find((i) => i.kind === "vita") as Extract<LogItem, { kind: "vita" }> | undefined;
  const live = open && (agent.busy || mic.listening || speaking || handsFree);
  const showBar = live && !panelPinned;

  function submit(text: string, { viaVoice = false } = {}) {
    const t = text.trim();
    if (!t) return;
    setHandsFree(viaVoice);
    if (!agent.busy) setPanelPinned(false); // a new task: get out of the way of the page
    setInput("");
    agent.send(t);
  }

  // Fetch Vita's voice model quietly after the app settles, so she sounds like herself from her first word.
  useEffect(() => {
    const t = window.setTimeout(preloadVoice, 3000);
    return () => window.clearTimeout(t);
  }, []);

  // ---- persistence ------------------------------------------------------
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads persisted chat history on mount; client-only to avoid an SSR hydration mismatch.
    setHistory(loadHistory());
    try {
      const raw = window.localStorage.getItem(POS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as FabPos;
        setFabPos(clampFabPos(saved.top, saved.left));
      }
    } catch {
      // ignore corrupt/missing position
    }
  }, []);

  // Autosave the conversation (minus transient step lines) so closing or switching never loses it.
  useEffect(() => {
    const persistable = agent.log.filter((i) => i.kind !== "step");
    if (persistable.length === 0) return;
    const title = (persistable.find((i) => i.kind === "user") as Extract<LogItem, { kind: "user" }> | undefined)?.text.slice(0, 60) ?? "New conversation";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derives saved history from the log; the setState is this effect's whole job.
    setHistory((prev) => {
      const next = [{ id: sessionId, title, items: persistable, updatedAt: Date.now() }, ...prev.filter((h) => h.id !== sessionId)]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, HISTORY_LIMIT);
      saveHistory(next);
      return next;
    });
  }, [agent.log, sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [agent.log, showBar]);

  // Hands-free loop: once Vita has finished talking (reply or approval question), listen again.
  useEffect(() => {
    if (!open || !handsFree || speaking || mic.listening || !armListenRef.current) return;
    if (agent.phase === "idle" || agent.phase === "approval") {
      armListenRef.current = false;
      startMic();
    }
  }, [open, handsFree, speaking, mic.listening, agent.phase, startMic]);

  // ---- greeting (once per browser) --------------------------------------
  useEffect(() => {
    let greeted = false;
    try {
      greeted = window.localStorage.getItem(GREETED_KEY) === "1";
    } catch {
      // ignore
    }
    if (greeted || open) return;
    const t = window.setTimeout(() => setShowGreeting(true), 1400);
    return () => window.clearTimeout(t);
  }, [open]);

  function dismissGreeting() {
    setShowGreeting(false);
    try {
      window.localStorage.setItem(GREETED_KEY, "1");
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!showGreeting) return;
    const t = window.setTimeout(dismissGreeting, 9000);
    return () => window.clearTimeout(t);
  }, [showGreeting]);

  // ---- session controls -------------------------------------------------
  function openVita() {
    dismissGreeting();
    preloadVoice();
    primeVoiceLevel();
    setOpen(true);
  }

  function closeVita() {
    agent.stop();
    stopMic();
    stopSpeaking();
    setHandsFree(false);
    setPanelPinned(false);
    setShowHistory(false);
    setOpen(false);
  }

  function endLive() {
    agent.stop();
    stopMic();
    stopSpeaking();
    setHandsFree(false);
  }

  function skipSpeech() {
    stopSpeaking();
    if (mic.supported) {
      setHandsFree(true);
      startMic();
    }
  }

  function toggleMic() {
    if (mic.listening) {
      stopMic();
      setHandsFree(false);
    } else {
      setHandsFree(true);
      startMic();
    }
  }

  function startNewChat() {
    agent.reset([]);
    setSessionId(newSessionId());
    setShowHistory(false);
  }

  function loadHistoryEntry(entry: HistoryEntry) {
    agent.reset(entry.items);
    setSessionId(entry.id);
    setShowHistory(false);
  }

  function deleteHistoryEntry(id: string) {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      saveHistory(next);
      return next;
    });
    if (id === sessionId) startNewChat();
  }

  // ---- draggable launcher -----------------------------------------------
  function handleFabPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!fabRef.current) return;
    const rect = fabRef.current.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTop: rect.top, startLeft: rect.left, moved: false };
    fabRef.current.setPointerCapture(e.pointerId);
  }

  function handleFabPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setFabPos(clampFabPos(drag.startTop + dy, drag.startLeft + dx));
  }

  function handleFabPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    fabRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    if (drag?.moved) {
      suppressClickRef.current = true;
      setFabPos((p) => {
        if (p) {
          try {
            window.localStorage.setItem(POS_KEY, JSON.stringify(p));
          } catch {
            // ignore
          }
        }
        return p;
      });
    }
  }

  function handleFabClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (open) closeVita();
    else openVita();
  }

  // Anchors the panel/greeting near a dragged launcher, flipping to whichever side keeps it on screen.
  function anchorNearFab(gap: number): CSSProperties | undefined {
    if (!fabPos || typeof window === "undefined") return undefined;
    const style: CSSProperties = {};
    if (fabPos.left + FAB_SIZE / 2 < window.innerWidth / 2) style.left = fabPos.left;
    else style.right = window.innerWidth - (fabPos.left + FAB_SIZE);
    if (fabPos.top + FAB_SIZE / 2 < window.innerHeight / 2) style.top = fabPos.top + FAB_SIZE + gap;
    else style.bottom = window.innerHeight - fabPos.top + gap;
    return style;
  }

  // ---- status -----------------------------------------------------------
  const status = mic.listening
    ? { label: "Listening", tone: "bg-sky-500" }
    : agent.phase === "approval"
      ? { label: "Needs your OK", tone: "bg-amber-500" }
      : agent.busy
        ? { label: "Working", tone: "bg-primary" }
        : speaking
          ? { label: "Speaking", tone: "bg-emerald-500" }
          : { label: "Ready", tone: "bg-muted-foreground/40" };

  const barDetail = mic.listening
    ? mic.interim || "Go ahead — I'm listening."
    : pendingApproval
      ? pendingApproval.summary
      : agent.busy
        ? agent.caption || "Thinking…"
        : speaking || lastReply
          ? (lastReply?.text ?? "")
          : "Tell me what to do — “record a $45 expense”, “open invoices”…";

  return (
    <>
      {/* Launcher */}
      <button
        ref={fabRef}
        data-vita-ui
        onClick={handleFabClick}
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
        style={fabPos ? { top: fabPos.top, left: fabPos.left } : undefined}
        className={`fixed z-50 flex touch-none cursor-grab items-center justify-center active:cursor-grabbing ${
          fabPos ? "" : "bottom-5 right-5"
        } ${open ? "size-12 rounded-full bg-card text-foreground shadow-lg ring-1 ring-foreground/10 transition hover:scale-105" : "size-16 drop-shadow-lg"}`}
        aria-label={open ? "Close Vita" : "Open Vita, your AI assistant"}
      >
        {open ? <X className="size-5" /> : <Mascot size={64} pulsing />}
      </button>

      {!open && showGreeting && (
        <div
          data-vita-ui
          className={`fixed z-40 w-64 rounded-2xl bg-card px-4 py-3 text-sm shadow-xl ring-1 ring-foreground/10 ${fabPos ? "" : "bottom-24 right-5"}`}
          style={anchorNearFab(14)}
        >
          <button
            onClick={dismissGreeting}
            aria-label="Dismiss"
            className="absolute -right-2 -top-2 flex size-5 cursor-pointer items-center justify-center rounded-full bg-foreground/15 text-muted-foreground hover:bg-foreground/25"
          >
            <X className="size-3" />
          </button>
          <p className="font-medium">Hey, I&apos;m Vita</p>
          <p className="mt-0.5 text-muted-foreground">Tell me what to do and I&apos;ll do it right here in VitaCount — you watch, I ask before saving.</p>
        </div>
      )}

      {/* Live bar: Vita is working / talking / listening — stay out of the way of the page */}
      {showBar && (
        <div
          data-vita-ui
          role="status"
          aria-live="polite"
          className="vita-bar-enter fixed bottom-5 left-1/2 z-[58] flex w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 rounded-3xl bg-card/95 p-2 pl-2.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] ring-1 ring-foreground/10 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Mascot size={36} interactive={false} pulsing />
              <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-card ${status.tone}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-semibold">
                Vita
                <span className="font-normal text-muted-foreground">· {status.label}</span>
                {agent.busy && agent.phase !== "approval" && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                {speaking && !mic.listening && (
                  <span className="vita-level flex items-center gap-[3px] text-emerald-500">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                )}
              </div>
              <p className={`truncate text-sm ${mic.listening && !mic.interim ? "text-muted-foreground" : ""}`}>{barDetail}</p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {pendingApproval ? (
                <>
                  <button
                    onClick={() => agent.resolveApproval(false)}
                    className="h-8 cursor-pointer rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => agent.resolveApproval(true)}
                    className="flex h-8 cursor-pointer items-center gap-1 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary/85"
                  >
                    <Check className="size-3.5" /> Approve
                  </button>
                </>
              ) : (
                <>
                  {speaking && (
                    <button
                      onClick={skipSpeech}
                      title="Skip — and talk"
                      className="flex h-8 cursor-pointer items-center gap-1 rounded-full bg-foreground/[0.07] px-3 text-xs font-medium hover:bg-foreground/[0.12]"
                    >
                      <SkipForward className="size-3.5" /> Skip
                    </button>
                  )}
                  {agent.busy && (
                    <button
                      onClick={agent.stop}
                      title="Stop (Esc)"
                      className="flex h-8 cursor-pointer items-center gap-1 rounded-full bg-destructive/10 px-3 text-xs font-medium text-destructive hover:bg-destructive/20"
                    >
                      <Square className="size-3 fill-current" /> Stop
                    </button>
                  )}
                </>
              )}
              {mic.supported && (
                <button
                  onClick={toggleMic}
                  title={mic.listening ? "Stop listening" : "Talk to Vita"}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors ${
                    mic.listening ? "bg-sky-500 text-white" : "bg-foreground/[0.07] hover:bg-foreground/[0.12]"
                  }`}
                >
                  <Mic className="size-4" />
                </button>
              )}
              <button onClick={() => setPanelPinned(true)} title="Show conversation" className={iconButton}>
                <ChevronUp className="size-4" />
              </button>
              <button onClick={endLive} title="End" className={iconButton}>
                <X className="size-4" />
              </button>
            </div>
          </div>

          {pendingApproval && pendingApproval.fields.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1 pb-0.5">
              {pendingApproval.fields.slice(0, 6).map((f) => (
                <span key={`${f.label}-${f.value}`} className="max-w-[16rem] truncate rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px]">
                  <span className="text-muted-foreground">{f.label}:</span> {f.value}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Panel */}
      {open && !showBar && (
        <div
          data-vita-ui
          className={`fixed z-50 flex h-[min(620px,calc(100vh-7rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl bg-card shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-foreground/10 ${
            fabPos ? "" : "bottom-20 right-5"
          }`}
          style={anchorNearFab(12)}
        >
          <div className="flex items-center gap-2.5 border-b border-foreground/[0.07] px-3 py-2.5">
            {showHistory ? (
              <button onClick={() => setShowHistory(false)} title="Back to chat" className={iconButton}>
                <ArrowLeft className="size-4" />
              </button>
            ) : (
              <div className="relative">
                <Mascot size={32} interactive={false} pulsing={live} />
                <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-card ${status.tone}`} />
              </div>
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-semibold">{showHistory ? "Conversations" : "Vita"}</div>
              {!showHistory && (
                <div className="text-xs text-muted-foreground">
                  {status.label}
                  {voiceOn && voiceEngine === "loading" && " · voice loading…"}
                </div>
              )}
            </div>
            {!showHistory && (
              <>
                {live && (
                  <button onClick={() => setPanelPinned(false)} title="Back to the live bar" className={iconButton}>
                    <ChevronDown className="size-4" />
                  </button>
                )}
                {agent.log.length > 0 && (
                  <button onClick={startNewChat} title="New chat" className={iconButton}>
                    <Plus className="size-4" />
                  </button>
                )}
                <button onClick={() => setShowHistory(true)} title="Conversations" className={iconButton}>
                  <History className="size-4" />
                </button>
                <button
                  onClick={() => {
                    if (voiceOn) stopSpeaking();
                    setVoiceOn((v) => !v);
                  }}
                  title={voiceOn ? "Mute Vita's voice" : "Let Vita speak"}
                  className={`${iconButton} ${voiceOn ? "text-primary" : ""}`}
                >
                  {voiceOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                </button>
              </>
            )}
            <button onClick={closeVita} title="Close" className={iconButton}>
              <X className="size-4" />
            </button>
          </div>

          {showHistory ? (
            <div className="flex-1 overflow-y-auto p-2">
              {history.length === 0 ? (
                <p className="px-2 py-10 text-center text-sm text-muted-foreground">No saved conversations yet.</p>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    className={`group flex items-center gap-1 rounded-xl px-2.5 py-2 hover:bg-foreground/[0.05] ${h.id === sessionId ? "bg-foreground/[0.05]" : ""}`}
                  >
                    <button onClick={() => loadHistoryEntry(h)} className="min-w-0 flex-1 cursor-pointer text-left">
                      <div className="truncate text-sm">{h.title || "New conversation"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(h.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </button>
                    <button
                      onClick={() => deleteHistoryEntry(h.id)}
                      title="Delete conversation"
                      className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {agent.log.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Mascot size={64} pulsing={live} />
                    <p className="mt-3 text-base font-semibold">Hi, I&apos;m Vita</p>
                    <p className="mt-1 max-w-[17rem] text-sm text-muted-foreground">
                      Tell me what to do — I&apos;ll do it on screen while you watch, and ask before saving anything.
                    </p>
                    <div className="mt-5 grid w-full gap-2">
                      {STARTERS.map((s) => (
                        <button
                          key={s}
                          onClick={() => submit(s)}
                          className="cursor-pointer rounded-2xl bg-foreground/[0.04] px-3.5 py-2.5 text-left text-sm ring-1 ring-foreground/[0.06] transition-colors hover:bg-foreground/[0.08]"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <LogView items={agent.log} onApprove={agent.resolveApproval} />
                )}
                {agent.phase === "thinking" && (
                  <div className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Thinking…
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(input);
                }}
                className="p-3 pt-0"
              >
                <div className="flex items-center gap-1.5 rounded-2xl bg-foreground/[0.04] p-1.5 pl-3.5 ring-1 ring-foreground/[0.08] focus-within:ring-primary/50">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      pendingApproval ? "Say yes, no, or what to change…" : agent.busy ? "Vita is working — Esc to stop" : "Tell Vita what to do…"
                    }
                    disabled={agent.busy && !pendingApproval}
                    className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                  />
                  {mic.supported && (
                    <button
                      type="button"
                      onClick={toggleMic}
                      title={mic.listening ? "Stop listening" : "Talk to Vita"}
                      className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors ${
                        mic.listening ? "bg-sky-500 text-white" : "text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
                      }`}
                    >
                      <Mic className="size-4" />
                    </button>
                  )}
                  {agent.busy && !pendingApproval ? (
                    <button
                      type="button"
                      onClick={agent.stop}
                      title="Stop (Esc)"
                      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-foreground text-background"
                    >
                      <Square className="size-3 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      title="Send"
                      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:cursor-default disabled:opacity-30"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                  )}
                </div>
                <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3" /> Vita asks before saving, paying or deleting anything.
                </p>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Conversation, with consecutive steps collapsed into one compact activity block. */
function LogView({ items, onApprove }: { items: LogItem[]; onApprove: (ok: boolean) => void }) {
  const groups: (LogItem | Extract<LogItem, { kind: "step" }>[])[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (item.kind === "step" && Array.isArray(last)) last.push(item);
    else groups.push(item.kind === "step" ? [item] : item);
  }

  return (
    <>
      {groups.map((group) => {
        if (Array.isArray(group)) {
          return (
            <div key={group[0].id} className="space-y-1.5 rounded-2xl bg-foreground/[0.03] px-3 py-2.5 ring-1 ring-foreground/[0.05]">
              {group.map((s) => (
                <div key={s.id} className="flex items-start gap-2 text-xs">
                  {s.status === "running" ? (
                    <Loader2 className="mt-px size-3.5 shrink-0 animate-spin text-primary" />
                  ) : s.status === "done" ? (
                    <Check className="mt-px size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <X className="mt-px size-3.5 shrink-0 text-destructive" />
                  )}
                  <span className={s.status === "running" ? "text-foreground" : "text-muted-foreground"}>{s.text}</span>
                </div>
              ))}
            </div>
          );
        }
        switch (group.kind) {
          case "user":
            return (
              <div key={group.id} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                {group.text}
              </div>
            );
          case "vita":
            return (
              <div key={group.id} className="w-fit max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-foreground/[0.05] px-3.5 py-2 text-sm">
                {group.text}
              </div>
            );
          case "error":
            return (
              <div key={group.id} className="rounded-2xl bg-destructive/10 px-3.5 py-2 text-sm text-destructive">
                {group.text}
              </div>
            );
          case "approval":
            return (
              <div
                key={group.id}
                className={`rounded-2xl p-3 ring-1 ${group.status === "pending" ? "bg-amber-500/[0.07] ring-amber-500/40" : "bg-foreground/[0.03] ring-foreground/[0.06]"}`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <ShieldCheck className={`size-3.5 ${group.status === "pending" ? "text-amber-500" : "text-muted-foreground"}`} />
                  {group.status === "pending" ? "Approve this?" : group.status === "approved" ? "Approved" : "Declined"}
                </div>
                <p className="mt-1.5 text-sm">{group.summary}</p>
                {group.fields.length > 0 && (
                  <dl className="mt-2 space-y-1 rounded-xl bg-card/70 px-3 py-2 text-xs">
                    {group.fields.map((f) => (
                      <div key={`${f.label}-${f.value}`} className="flex justify-between gap-3">
                        <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
                        <dd className="truncate text-right font-medium">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {group.status === "pending" && (
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => onApprove(false)}
                      className="h-8 cursor-pointer rounded-full px-3.5 text-xs font-medium text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => onApprove(true)}
                      className="flex h-8 cursor-pointer items-center gap-1 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/85"
                    >
                      <Check className="size-3.5" /> Approve
                    </button>
                  </div>
                )}
              </div>
            );
        }
      })}
    </>
  );
}
