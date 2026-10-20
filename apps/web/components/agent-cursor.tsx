"use client";

import { useSyncExternalStore } from "react";

type Rect = { top: number; left: number; width: number; height: number };

type CursorState = {
  visible: boolean;
  x: number;
  y: number;
  /** ms for the current move, so long hops glide and short ones snap */
  duration: number;
  caption: string;
  /** caption sits left of the pointer near the right edge, so it never runs off screen */
  flip: boolean;
  /** bumps on every click so the ripple remounts and replays */
  clickKey: number;
  highlight: Rect | null;
  /** Vita is driving the page — draws the "in control" edge glow */
  active: boolean;
};

const INITIAL: CursorState = { visible: false, x: 0, y: 0, duration: 0, caption: "", flip: false, clickKey: 0, highlight: null, active: false };

let state = INITIAL;
const listeners = new Set<() => void>();

function set(patch: Partial<CursorState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function inViewport(rect: DOMRect) {
  return rect.top >= 64 && rect.bottom <= window.innerHeight - 96 && rect.left >= 0 && rect.right <= window.innerWidth;
}

/** Imperative handle the agent runner awaits, so actions land only after the cursor visibly gets there. */
export const vitaCursor = {
  async moveTo(el: Element, caption?: string) {
    if (!state.visible) {
      // Enter from the Vita launcher's corner rather than popping in mid-screen.
      set({ visible: true, x: window.innerWidth - 72, y: window.innerHeight - 72, duration: 0 });
      await sleep(30);
    }
    if (!inViewport(el.getBoundingClientRect())) {
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      await sleep(420);
    }
    const rect = el.getBoundingClientRect();
    const isField = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
    const x = isField ? rect.left + Math.min(28, rect.width / 2) : rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const distance = Math.hypot(x - state.x, y - state.y);
    const duration = Math.round(Math.min(750, Math.max(260, distance / 1.7)));
    set({
      x,
      y,
      duration,
      flip: x > window.innerWidth - 300,
      caption: caption ?? state.caption,
      highlight: { top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 },
    });
    await sleep(duration + 40);
  },

  async click() {
    set({ clickKey: state.clickKey + 1 });
    await sleep(160);
  },

  setCaption(caption: string) {
    set({ caption });
  },

  clearHighlight() {
    set({ highlight: null });
  },

  setActive(active: boolean) {
    set(active ? { active } : { active, highlight: null });
  },

  hide() {
    set({ visible: false, highlight: null, caption: "" });
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function AgentCursor() {
  const s = useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );

  return (
    <div data-vita-ui aria-hidden="true">
      {s.active && <div className="vita-control-glow pointer-events-none fixed inset-0 z-[55]" />}

      {s.highlight && (
        <div
          className="pointer-events-none fixed z-[56] rounded-xl ring-2 ring-primary/80 shadow-[0_0_0_6px_color-mix(in_oklch,var(--primary)_18%,transparent)] transition-all duration-300 ease-out"
          style={{ top: s.highlight.top, left: s.highlight.left, width: s.highlight.width, height: s.highlight.height }}
        />
      )}

      {s.visible && (
        <div
          className="pointer-events-none fixed left-0 top-0 z-[60]"
          style={{
            transform: `translate3d(${s.x}px, ${s.y}px, 0)`,
            transition: `transform ${s.duration}ms cubic-bezier(0.22, 0.75, 0.25, 1)`,
          }}
        >
          {s.clickKey > 0 && <span key={s.clickKey} className="vita-click-ripple absolute -left-5 -top-5 h-10 w-10 rounded-full bg-primary/35" />}
          <svg width="22" height="24" viewBox="0 0 22 24" className="relative drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]">
            <path
              d="M2 1.5 L2 19.5 L7.2 14.8 L10.6 22.2 L14 20.7 L10.7 13.4 L17.6 13.1 Z"
              fill="var(--primary)"
              stroke="white"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <div
            className={`absolute top-6 flex max-w-[260px] items-center gap-1.5 whitespace-nowrap rounded-full bg-primary py-1 pl-1 pr-2.5 text-[11px] font-medium text-primary-foreground shadow-lg ${
              s.flip ? "right-2" : "left-5"
            }`}
          >
            <span className="rounded-full bg-primary-foreground/20 px-1.5 py-px text-[10px] font-semibold lowercase tracking-wide">vita</span>
            {s.caption && <span className="truncate">{s.caption}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
