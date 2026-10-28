"use client";

import { createContext, useContext, useId, useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";

export const AgentPromptContext = createContext<{
  busy: boolean;
  send: (text: string) => boolean;
} | null>(null);

export function AgentPromptBar() {
  const agent = useContext(AgentPromptContext);
  const [input, setInput] = useState("");
  const id = useId();
  const busy = agent?.busy ?? false;

  return (
    <form
      data-vita-ui
      aria-label="Ask Vita"
      onSubmit={(event) => {
        event.preventDefault();
        if (input.trim() && agent?.send(input)) setInput("");
      }}
      className="rounded-[24px] bg-[linear-gradient(110deg,#f4b665_0%,#edab70_32%,#7885ff_57%,#9b78ff_100%)] p-[2px] shadow-sm transition-shadow focus-within:ring-4 focus-within:ring-violet-400/20"
    >
      <div className="flex min-h-[72px] items-center gap-3 rounded-[22px] bg-card bg-[linear-gradient(110deg,rgba(244,182,101,0.04),rgba(155,120,255,0.06))] p-2 pl-4 sm:min-h-[84px] sm:gap-4 sm:pl-6">
        <Sparkles aria-hidden="true" className="size-6 shrink-0 text-violet-500 dark:text-violet-400" />
        <label htmlFor={id} className="sr-only">Ask Vita or add a task</label>
        <input
          id={id}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={busy ? "Vita is working…" : "Ask Vita or add a task — “What's my net profit this month?”"}
          readOnly={busy}
          className="min-w-0 flex-1 bg-transparent py-3 text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-lg"
        />
        <button
          type="submit"
          disabled={!agent || busy || !input.trim()}
          aria-label={busy ? "Vita is working" : "Send message to Vita"}
          className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-[17px] bg-violet-600 text-white transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600 sm:size-14"
        >
          {busy ? <Loader2 aria-hidden="true" className="size-6 animate-spin motion-reduce:animate-none" /> : <ArrowUp aria-hidden="true" className="size-6" />}
        </button>
      </div>
    </form>
  );
}
