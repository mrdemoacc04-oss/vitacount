"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ALL_NAV_ITEMS, CREATE_SECTIONS } from "@/lib/navigation";
import { Icons, type Icon } from "@/components/icons";

type Command = { id: string; group: string; label: string; hint?: string; href: string; icon: Icon; haystack: string };

const COMMANDS: Command[] = [
  ...CREATE_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      id: `new:${item.href}`,
      group: "Create",
      label: `New ${item.label.toLowerCase()}`,
      hint: section.title,
      href: item.href,
      icon: item.icon,
      haystack: `new create add ${item.label} ${item.description} ${section.title}`.toLowerCase(),
    })),
  ),
  ...ALL_NAV_ITEMS.map((item) => ({
    id: `go:${item.href}`,
    group: "Go to",
    label: item.label,
    href: item.href,
    icon: item.icon,
    haystack: `go open ${item.label} ${item.keywords ?? ""}`.toLowerCase(),
  })),
  {
    id: "new:contact",
    group: "Create",
    label: "New contact",
    hint: "Customer or supplier",
    href: "/contacts/new",
    icon: Icons.userPlus,
    haystack: "new create add contact customer supplier vendor",
  },
];

/** Every query word must appear somewhere; label-prefix hits rank first. */
function search(query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMMANDS.filter((c) => c.group === "Go to" || c.id.includes("invoice") || c.id.endsWith("type=expense"));
  const words = q.split(/\s+/);
  return COMMANDS.filter((c) => words.every((w) => c.haystack.includes(w)))
    .map((c) => ({ c, score: c.label.toLowerCase().startsWith(q) ? 0 : c.label.toLowerCase().includes(q) ? 1 : 2 }))
    .sort((a, b) => a.score - b.score)
    .map(({ c }) => c);
}

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const results = useMemo(() => search(query), [query]);
  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, Command[]>();
    for (const r of results) {
      if (!byGroup.has(r.group)) {
        byGroup.set(r.group, []);
        order.push(r.group);
      }
      byGroup.get(r.group)!.push(r);
    }
    return order.map((g) => ({ group: g, items: byGroup.get(g)! }));
  }, [results]);
  // Flattened in render order so arrow keys walk the list the way it reads.
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // ⌘K / Ctrl+K anywhere toggles the menu.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  function close() {
    onOpenChange(false);
    setQuery("");
    setIndex(0);
  }

  function run(cmd: Command | undefined) {
    if (!cmd) return;
    close();
    router.push(cmd.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(flat[index]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" role="presentation">
      <div className="animate-in fade-in absolute inset-0 bg-foreground/15 backdrop-blur-[2px] duration-150 dark:bg-black/50" onMouseDown={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        className="animate-pop-in relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-popover shadow-soft"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Icons.search className="size-[18px] shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            placeholder="Search pages or create something…"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat[index] ? `${listId}-${index}` : undefined}
            className="h-13 w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="hidden shrink-0 rounded-md border border-border px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground sm:block">
            Esc
          </kbd>
        </div>

        <div ref={listRef} id={listId} role="listbox" className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
          {flat.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-foreground">Nothing matches &ldquo;{query}&rdquo;</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a page name like &ldquo;banking&rdquo; or an action like &ldquo;new bill&rdquo;.</p>
            </div>
          ) : (
            groups.map(({ group, items }) => (
              <div key={group} role="group" aria-label={group} className="pb-1">
                <p className="px-2.5 pb-1 pt-2 text-[11.5px] font-medium text-muted-foreground/80">{group}</p>
                {items.map((cmd) => {
                  const i = flat.indexOf(cmd);
                  const selected = i === index;
                  const ItemIcon = cmd.icon;
                  return (
                    <div
                      key={cmd.id}
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => index !== i && setIndex(i)}
                      onClick={() => run(cmd)}
                      className={`flex h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-[13.5px] transition-colors duration-75 ${
                        selected ? "bg-accent text-foreground" : "text-foreground/85"
                      }`}
                    >
                      <ItemIcon className={`size-[17px] shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="flex-1 truncate">{cmd.label}</span>
                      {cmd.hint && <span className="shrink-0 text-xs text-muted-foreground">{cmd.hint}</span>}
                      {selected && <Icons.arrowRight className="size-3.5 shrink-0 text-primary" />}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border bg-muted/40 px-4 py-2 text-[11.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">↵</kbd> Open
          </span>
        </div>
      </div>
    </div>
  );
}
