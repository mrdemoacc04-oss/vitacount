"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { vitaCursor } from "@/components/agent-cursor";
import { describeUiCall, executeUiTool, snapshotPage, type ApprovalRequest, type FormField } from "@/lib/agent/dom";
import { isUiTool } from "@/lib/agent/ui-tools";

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ChatMessage = { role: "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };

export type LogItem =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "vita"; text: string }
  | { id: string; kind: "step"; text: string; status: "running" | "done" | "failed" }
  | { id: string; kind: "approval"; summary: string; fields: FormField[]; status: "pending" | "approved" | "declined" }
  | { id: string; kind: "error"; text: string };

export type AgentPhase = "idle" | "thinking" | "acting" | "approval";

const MAX_STEPS = 20;
const PAGE_BLOCK = /<page>[\s\S]*?<\/page>/g;

let seq = 0;
const uid = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

function localISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Only the newest page snapshot matters to the model; older ones are stale and just burn context. */
function withLatestSnapshotOnly(messages: ChatMessage[]): ChatMessage[] {
  let last = -1;
  messages.forEach((m, i) => {
    if (m.content?.includes("<page>")) last = i;
  });
  return messages.map((m, i) =>
    i !== last && m.content?.includes("<page>") ? { ...m, content: m.content.replace(PAGE_BLOCK, "<page>(earlier snapshot omitted)</page>") } : m,
  );
}

const AFFIRMATIVE = /^(yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|approve|approved|confirm|correct|please do|sounds good)\b/i;

export interface VitaCallbacks {
  /** Progress narration — spoken only if voice is on. */
  onNarrate: (text: string) => void;
  onReply: (text: string) => void;
  onApprovalRequested: (summary: string) => void;
}

export function useVitaAgent(callbacks: VitaCallbacks) {
  const router = useRouter();
  const [log, setLog] = useState<LogItem[]>([]);
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [caption, setCaption] = useState("");
  const convoRef = useRef<ChatMessage[]>([]);
  const busyRef = useRef(false);
  const stoppedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const approvalRef = useRef<{ itemId: string; resolve: (ok: boolean) => void } | null>(null);
  // What the user said instead of a plain yes/no at an approval — folded into the declined action's result.
  const approvalNoteRef = useRef<string | null>(null);
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const push = useCallback((item: LogItem) => setLog((prev) => [...prev, item]), []);
  const patch = useCallback(
    (id: string, update: Partial<LogItem>) => setLog((prev) => prev.map((i) => (i.id === id ? ({ ...i, ...update } as LogItem) : i))),
    [],
  );

  const resolveApproval = useCallback(
    (ok: boolean) => {
      const pending = approvalRef.current;
      if (!pending) return;
      approvalRef.current = null;
      patch(pending.itemId, { status: ok ? "approved" : "declined" });
      pending.resolve(ok);
    },
    [patch],
  );

  const stop = useCallback(() => {
    if (!busyRef.current) return;
    stoppedRef.current = true;
    abortRef.current?.abort();
    resolveApproval(false);
  }, [resolveApproval]);

  // Esc always takes control back from Vita.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && busyRef.current) stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stop]);

  const requestApproval = useCallback(
    (req: ApprovalRequest) =>
      new Promise<boolean>((resolve) => {
        const itemId = uid();
        push({ id: itemId, kind: "approval", summary: req.summary, fields: req.fields, status: "pending" });
        approvalRef.current = { itemId, resolve };
        setPhase("approval");
        callbacksRef.current.onApprovalRequested(req.summary);
      }).finally(() => setPhase("acting")),
    [push],
  );

  const run = useCallback(
    async (text: string) => {
      busyRef.current = true;
      stoppedRef.current = false;
      const abort = new AbortController();
      abortRef.current = abort;
      push({ id: uid(), kind: "user", text });
      convoRef.current.push({ role: "user", content: `${text}\n\n<page>\n${snapshotPage()}\n</page>` });
      vitaCursor.setActive(true);
      setPhase("thinking");

      const hooks = {
        navigate: (href: string) => router.push(href),
        requestApproval,
        onApproved: (req: ApprovalRequest) => {
          void fetch("/api/agent/audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...req, path: location.pathname }),
          }).catch(() => {});
        },
        narrate: (t: string) => callbacksRef.current.onNarrate(t),
        isStopped: () => stoppedRef.current,
      };

      try {
        let finished = false;
        for (let step = 0; step < MAX_STEPS && !stoppedRef.current; step++) {
          setPhase("thinking");
          setCaption("Thinking…");
          const res = await fetch("/api/agent/step", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: withLatestSnapshotOnly(convoRef.current), clientDate: localISODate() }),
            signal: abort.signal,
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data) throw new Error(data?.error ?? "Vita couldn't reach the model.");

          for (const say of data.said as string[]) {
            push({ id: uid(), kind: "step", text: say, status: "done" });
            callbacksRef.current.onNarrate(say);
          }
          const newMessages = data.messages as ChatMessage[];
          convoRef.current.push(...newMessages);

          const last = newMessages[newMessages.length - 1];
          if (last?.role === "assistant" && !last.tool_calls?.length) {
            const reply = last.content ?? "";
            push({ id: uid(), kind: "vita", text: reply });
            callbacksRef.current.onReply(reply);
            finished = true;
            break;
          }

          const assistant = [...newMessages].reverse().find((m) => m.role === "assistant");
          const answered = new Set(newMessages.filter((m) => m.role === "tool").map((m) => m.tool_call_id));
          const pending = (assistant?.tool_calls ?? []).filter((c) => !answered.has(c.id) && isUiTool(c.function.name));
          if (pending.length === 0) continue; // only data lookups this round — ask the model again

          setPhase("acting");
          let failed = false;
          for (let i = 0; i < pending.length; i++) {
            const call = pending[i];
            let message: string;
            let ok = false;
            if (stoppedRef.current) {
              message = "Stopped by the user.";
            } else if (failed) {
              message = "Skipped because an earlier step failed.";
            } else {
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(call.function.arguments || "{}");
              } catch {
                args = {};
              }
              const name = call.function.name as Parameters<typeof executeUiTool>[0];
              const label = describeUiCall(name, args);
              const stepId = uid();
              push({ id: stepId, kind: "step", text: label, status: "running" });
              setCaption(label);
              const result = await executeUiTool(name, args, hooks);
              ok = result.ok;
              message = result.message;
              if (approvalNoteRef.current) {
                message += ` Instead, the user said: “${approvalNoteRef.current}”.`;
                approvalNoteRef.current = null;
              }
              patch(stepId, { status: ok ? "done" : "failed" });
              if (!ok) failed = true;
            }
            // The last result (or the failure point) carries a fresh snapshot so the model sees the page as it is now.
            const withSnapshot = i === pending.length - 1 || (!ok && !stoppedRef.current && message !== "Skipped because an earlier step failed.");
            convoRef.current.push({
              role: "tool",
              tool_call_id: call.id,
              content: withSnapshot && !stoppedRef.current ? `${message}\n\n<page>\n${snapshotPage()}\n</page>` : message,
            });
          }
        }

        if (stoppedRef.current) {
          push({ id: uid(), kind: "vita", text: "Stopped. Your page is as I left it." });
        } else if (!finished) {
          const reply = "That took more steps than I allow myself — tell me to keep going if it isn't finished.";
          push({ id: uid(), kind: "vita", text: reply });
          callbacksRef.current.onReply(reply);
        }
      } catch (err) {
        if (stoppedRef.current || (err instanceof DOMException && err.name === "AbortError")) {
          push({ id: uid(), kind: "vita", text: "Stopped. Your page is as I left it." });
        } else {
          push({ id: uid(), kind: "error", text: err instanceof Error ? err.message : "Something went wrong." });
        }
      } finally {
        // A stop mid-turn can leave tool calls unanswered; answer them so the next request is still valid.
        const lastAssistant = [...convoRef.current].reverse().find((m) => m.role === "assistant" && m.tool_calls?.length);
        if (lastAssistant) {
          const answered = new Set(convoRef.current.filter((m) => m.role === "tool").map((m) => m.tool_call_id));
          for (const c of lastAssistant.tool_calls!) {
            if (!answered.has(c.id)) convoRef.current.push({ role: "tool", tool_call_id: c.id, content: "Stopped by the user." });
          }
        }
        busyRef.current = false;
        abortRef.current = null;
        setPhase("idle");
        setCaption("");
        vitaCursor.setActive(false);
        window.setTimeout(() => {
          if (!busyRef.current) vitaCursor.hide();
        }, 1400);
      }
    },
    [push, patch, requestApproval, router],
  );

  /**
   * Everything the user says or types goes through here: an answer to a pending
   * approval ("yes" / "no, make it $50"), a "stop" while Vita works, or a new task.
   */
  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      if (approvalRef.current) {
        const ok = AFFIRMATIVE.test(t);
        push({ id: uid(), kind: "user", text: t });
        // A correction rather than a plain no ("no, make it $50") goes back to the model with the declined result.
        if (!ok && !/^(no|nope|cancel|stop|don'?t)\W*$/i.test(t)) approvalNoteRef.current = t;
        resolveApproval(ok);
        return;
      }
      if (busyRef.current) {
        if (/^(stop|cancel|wait|hold on|pause)\b/i.test(t)) stop();
        return;
      }
      void run(t);
    },
    [push, resolveApproval, run, stop],
  );

  const reset = useCallback(
    (items: LogItem[] = []) => {
      stop();
      setLog(items);
      // Rebuild a text-only conversation so an old chat can be continued.
      convoRef.current = items.flatMap((i): ChatMessage[] =>
        i.kind === "user" ? [{ role: "user", content: i.text }] : i.kind === "vita" ? [{ role: "assistant", content: i.text }] : [],
      );
      while (convoRef.current[0] && convoRef.current[0].role !== "user") convoRef.current.shift();
    },
    [stop],
  );

  return { log, phase, caption, busy: phase !== "idle", send, stop, resolveApproval, reset };
}
