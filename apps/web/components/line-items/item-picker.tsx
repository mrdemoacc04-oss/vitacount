"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icons } from "@/components/icons";
import { ITEM_TYPE_LABEL, formatQuantity, type CatalogItem } from "@/components/forms/catalog";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 50;

/**
 * Item combobox for a line: search by name or SKU, arrow keys to move, Enter to
 * pick, Escape to close. The first option is always "Custom line" (no item), so a
 * free-text line stays one keystroke away.
 */
export function ItemPicker({
  items,
  value,
  onChange,
  priceKind,
  id,
  "aria-label": ariaLabel,
  invalid,
  className,
  "data-field": dataField,
  firstInRow,
}: {
  items: CatalogItem[];
  value: string;
  onChange: (item: CatalogItem | null) => void;
  priceKind: "sales" | "purchase";
  id?: string;
  "aria-label": string;
  invalid?: boolean;
  className?: string;
  "data-field"?: string;
  /** marks the trigger as the line's first control, for keyboard focus after adding a line */
  firstInRow?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = items.find((i) => i.id === value) ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? items.filter(
          (i) => i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q),
        )
      : items;
    return matches.slice(0, MAX_RESULTS);
  }, [items, query]);

  // option 0 is "Custom line"; items follow
  const optionCount = results.length + 1;

  function openWith(initialQuery = "") {
    setQuery(initialQuery);
    const selectedIndex = initialQuery ? -1 : items.findIndex((i) => i.id === value);
    setActive(initialQuery ? (items.length ? 1 : 0) : selectedIndex >= 0 && selectedIndex < MAX_RESULTS ? selectedIndex + 1 : 0);
    setOpen(true);
  }

  function close(refocus: boolean) {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  }

  function choose(index: number) {
    onChange(index === 0 ? null : (results[index - 1] ?? null));
    close(true);
  }

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => (a + 1) % optionCount);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => (a - 1 + optionCount) % optionCount);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(optionCount - 1);
        break;
      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        choose(Math.min(active, optionCount - 1));
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close(true);
        break;
      case "Tab":
        setOpen(false);
        setQuery("");
        break;
    }
  }

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openWith();
    } else if (e.key.length === 1 && /\S/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // start typing on the closed picker to search
      e.preventDefault();
      openWith(e.key);
    } else if (e.key === "Enter") {
      // Enter opens the picker instead of submitting the form / adding a line
      e.preventDefault();
      e.stopPropagation();
      openWith();
    }
  }

  const price = (item: CatalogItem) => (priceKind === "sales" ? item.salesPrice : item.purchaseCost);
  const activeId = open ? `${listId}-opt-${active}` : undefined;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        data-field={dataField}
        data-line-first={firstInRow ? "" : undefined}
        onClick={() => (open ? close(false) : openWith())}
        onKeyDown={onTriggerKey}
        className="flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card pl-3 pr-2 text-left text-sm shadow-soft-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15"
      >
        <span className={cn("min-w-0 flex-1 truncate", selected ? "text-foreground" : "text-muted-foreground")}>
          {selected ? selected.name : "Custom line"}
        </span>
        {selected?.sku && <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground lg:inline">{selected.sku}</span>}
        <Icons.chevronUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Icons.search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-label="Search items by name or SKU"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeId}
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(e.target.value.trim() ? 1 : 0);
              }}
              onKeyDown={onSearchKey}
              placeholder="Search by name or SKU"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label="Items" className="max-h-72 overflow-y-auto p-1">
            <Option
              id={`${listId}-opt-0`}
              index={0}
              active={active === 0}
              selected={!selected}
              onHover={setActive}
              onPick={choose}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-[13px] font-medium text-foreground">Custom line</span>
                <span className="text-xs text-muted-foreground">No item — type your own description and price</span>
              </span>
            </Option>
            {results.map((item, i) => {
              const p = price(item);
              const lowStock = item.type === "inventory" && (item.onHand ?? 0) <= 0;
              return (
                <Option
                  key={item.id}
                  id={`${listId}-opt-${i + 1}`}
                  index={i + 1}
                  active={active === i + 1}
                  selected={item.id === value}
                  onHover={setActive}
                  onPick={choose}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">{item.name}</span>
                      {item.sku && <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{item.sku}</span>}
                    </span>
                    <span className={cn("text-xs", lowStock ? "text-warning" : "text-muted-foreground")}>
                      {ITEM_TYPE_LABEL[item.type]}
                      {item.type === "inventory" && ` · ${formatQuantity(item.onHand ?? 0)} on hand`}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                    {p === null ? "—" : formatMoney(p)}
                    {p !== null && item.unit ? <span className="text-xs"> / {item.unit}</span> : null}
                  </span>
                </Option>
              );
            })}
          </ul>
          {items.length === 0 ? (
            <p className="border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
              No items yet.{" "}
              <Link href="/inventory" className="font-medium text-primary hover:underline">
                Add products and services
              </Link>{" "}
              to fill lines in one click.
            </p>
          ) : (
            results.length === 0 && (
              <p className="border-t border-border px-3 py-2.5 text-xs text-muted-foreground">No items match &ldquo;{query.trim()}&rdquo;.</p>
            )
          )}
        </div>
      )}
    </div>
  );
}

function Option({
  id,
  index,
  active,
  selected,
  onHover,
  onPick,
  children,
}: {
  id: string;
  index: number;
  active: boolean;
  selected: boolean;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
  children: React.ReactNode;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      data-index={index}
      onMouseMove={() => !active && onHover(index)}
      // mousedown so the search input doesn't blur (and close) before the click lands
      onMouseDown={(e) => {
        e.preventDefault();
        onPick(index);
      }}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2",
        active ? "bg-accent" : "bg-transparent",
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-primary">{selected && <Icons.check className="size-4" />}</span>
      {children}
    </li>
  );
}
