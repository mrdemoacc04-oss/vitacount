"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * Rows for a line-item table, with keyboard flow: Enter in a line's text field
 * moves to the next line, adding one when it's the last. New rows get focus on
 * their first control (marked `data-line-first`).
 */
export function useLineRows<T extends { key: number }>(initial: T[], makeEmpty: (key: number) => T) {
  const nextKey = useRef(initial.reduce((max, r) => Math.max(max, r.key), -1) + 1);
  const [rows, setRows] = useState<T[]>(initial);
  const containerRef = useRef<HTMLDivElement>(null);
  // a fresh object each time, so focusing the same row twice still runs the effect
  const [focusRequest, setFocusRequest] = useState<{ key: number } | null>(null);
  const setFocusKey = (key: number) => setFocusRequest({ key });

  useEffect(() => {
    if (focusRequest === null) return;
    containerRef.current?.querySelector<HTMLElement>(`[data-row-key="${focusRequest.key}"] [data-line-first]`)?.focus();
  }, [focusRequest]);

  function update(key: number, patch: Partial<T>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function add(focus = true) {
    const key = nextKey.current++;
    setRows((prev) => [...prev, makeEmpty(key)]);
    if (focus) setFocusKey(key);
    return key;
  }

  function remove(key: number) {
    if (rows.length === 1) {
      const fresh = makeEmpty(nextKey.current++);
      setRows([fresh]);
      setFocusKey(fresh.key);
      return;
    }
    const index = rows.findIndex((r) => r.key === key);
    const next = rows.filter((r) => r.key !== key);
    setRows(next);
    // keep the keyboard user in the table: focus the line that took its place
    const neighbour = next[Math.min(index, next.length - 1)];
    if (neighbour) setFocusKey(neighbour.key);
  }

  /** Attach to the lines container. */
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target.tagName !== "INPUT") return;
    const rowEl = target.closest<HTMLElement>("[data-row-key]");
    if (!rowEl) return;
    e.preventDefault(); // don't submit the form from inside the table
    const key = Number(rowEl.dataset.rowKey);
    const index = rows.findIndex((r) => r.key === key);
    const next = rows[index + 1];
    if (next) setFocusKey(next.key);
    else add(true);
  }

  return { rows, setRows, update, add, remove, containerRef, onKeyDown };
}
