"use client";

/**
 * Vita's eyes and hands. `snapshotPage` turns the live DOM into a compact,
 * id-tagged list of interactive elements the model can act on; `executeUiTool`
 * performs one UI tool call against the real page — moving the visible cursor,
 * then clicking/typing/selecting through the same DOM events a person would
 * trigger, so React state, validation and server actions all run as normal.
 */
import { vitaCursor } from "@/components/agent-cursor";
import type { UiToolName } from "@/lib/agent/ui-tools";

export type FormField = { label: string; value: string };
export type ApprovalRequest = { summary: string; fields: FormField[] };
export type UiResult = { ok: boolean; message: string };

export interface ExecHooks {
  navigate: (href: string) => void;
  /** Resolves true only if the user approves. */
  requestApproval: (req: ApprovalRequest) => Promise<boolean>;
  onApproved: (req: ApprovalRequest) => void;
  narrate: (text: string) => void;
  isStopped: () => boolean;
}

const ID_ATTR = "data-vita-id";
const INTERACTIVE =
  'a[href], button, input:not([type="hidden"]):not([type="file"]), select, textarea, summary, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"], [role="switch"]';
const MAX_ELEMENTS = 160;
const SNAPSHOT_TEXT_CHARS = 2500;
const READ_PAGE_CHARS = 12_000;

// Buttons whose click commits something. Clicking one always pauses for the user's approval.
const COMMIT_WORDS =
  /\b(save|create|record|post|pay|submit|send|issue|delete|remove|void|approve|reject|refund|confirm|invite|apply|log ?out|sign ?out|connect|disconnect|archive|kill|reverse|match|exclude|upload)\b/i;
const CHAR_TYPED_INPUTS = new Set(["text", "search", "email", "tel", "url", ""]);

let nextId = 1;
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function clean(text: string | null | undefined, max: number): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function insideVita(node: Node | null): boolean {
  const el = node instanceof Element ? node : node?.parentElement;
  return !!el?.closest("[data-vita-ui]");
}

function isVisible(el: Element): boolean {
  if (insideVita(el) || el.getClientRects().length === 0) return false;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function isFormControl(el: Element): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
}

function labelFor(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    if (text) return text;
  }
  if (isFormControl(el)) {
    const labels = el.labels ? Array.from(el.labels).map((l) => l.textContent ?? "").join(" ").trim() : "";
    if (labels) return labels;
    return el.getAttribute("placeholder") || el.getAttribute("name") || el.getAttribute("title") || "";
  }
  const text = (el as HTMLElement).innerText ?? el.textContent ?? "";
  return text.trim() || el.getAttribute("title") || "";
}

function isSubmitControl(el: Element): boolean {
  if (el instanceof HTMLButtonElement) return el.type === "submit" && el.form !== null;
  if (el instanceof HTMLInputElement) return (el.type === "submit" || el.type === "image") && el.form !== null;
  return false;
}

function needsApproval(el: Element): boolean {
  if (isSubmitControl(el)) return true;
  if (el instanceof HTMLAnchorElement) return false;
  return COMMIT_WORDS.test(labelFor(el));
}

function region(el: Element): string {
  if (el.closest('[role="dialog"], dialog')) return " (dialog)";
  if (el.closest("aside")) return " (sidebar)";
  if (el.closest("header")) return " (top bar)";
  return "";
}

function stampId(el: Element): number {
  let id = el.getAttribute(ID_ATTR);
  if (!id) {
    id = String(nextId++);
    el.setAttribute(ID_ATTR, id);
  }
  return Number(id);
}

function describeElement(el: Element, id: number): string {
  const label = clean(labelFor(el), 70);
  const flags: string[] = [];
  if ((el as HTMLButtonElement).disabled) flags.push("disabled");
  if (isFormControl(el) && el.required) flags.push("required");
  const flagText = flags.length ? ` {${flags.join(", ")}}` : "";

  if (el instanceof HTMLAnchorElement) {
    const href = el.getAttribute("href") ?? "";
    return `[${id}] link "${label}" → ${href.startsWith("/") ? href : "external"}${region(el)}${flagText}`;
  }
  if (el instanceof HTMLSelectElement) {
    const options = Array.from(el.options)
      .slice(0, 40)
      .map((o) => `"${clean(o.text, 40)}"`)
      .join(" | ");
    const more = el.options.length > 40 ? ` | …${el.options.length - 40} more` : "";
    return `[${id}] select "${label}" value="${clean(el.selectedOptions[0]?.text, 40)}" options: ${options}${more}${region(el)}${flagText}`;
  }
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox" || el.type === "radio") {
      return `[${id}] ${el.type} "${label}" ${el.checked ? "checked" : "unchecked"}${region(el)}${flagText}`;
    }
    const value = el.type === "password" ? (el.value ? "••••" : "") : clean(el.value, 60);
    const placeholder = el.placeholder && !el.value ? ` placeholder="${clean(el.placeholder, 40)}"` : "";
    return `[${id}] input[${el.type || "text"}] "${label}" value="${value}"${placeholder}${region(el)}${flagText}`;
  }
  if (el instanceof HTMLTextAreaElement) {
    return `[${id}] textarea "${label}" value="${clean(el.value, 80)}"${region(el)}${flagText}`;
  }
  const kind = isSubmitControl(el) ? "button[submit]" : el.getAttribute("role") || el.tagName.toLowerCase();
  const expanded = el.getAttribute("aria-expanded");
  return `[${id}] ${kind} "${label}"${expanded ? ` (${expanded === "true" ? "open" : "closed"})` : ""}${region(el)}${flagText}`;
}

function mainText(max: number): string {
  const root = document.querySelector("main") ?? document.body;
  const text = (root as HTMLElement).innerText
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return text.length > max ? `${text.slice(0, max)}\n…(truncated — use read_page for more)` : text;
}

/** The page as the model sees it: URL, headings, every visible control with a stable [id], alerts, and visible text. */
export function snapshotPage(): string {
  const all = Array.from(document.querySelectorAll(INTERACTIVE)).filter(isVisible);
  let chosen = all;
  let omitted = 0;
  if (all.length > MAX_ELEMENTS) {
    // Keep navigation chrome plus what's on or near the screen; the rest is reachable by scrolling.
    const near = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.bottom > -window.innerHeight && r.top < window.innerHeight * 2;
    };
    chosen = all.filter((el) => el.closest("aside, header") || near(el)).slice(0, MAX_ELEMENTS);
    omitted = all.length - chosen.length;
  }

  const headings = Array.from(document.querySelectorAll("main h1, main h2"))
    .filter(isVisible)
    .slice(0, 4)
    .map((h) => clean(h.textContent, 60));
  const alerts = Array.from(document.querySelectorAll('[role="alert"]'))
    .filter(isVisible)
    .map((a) => clean(a.textContent, 200))
    .filter(Boolean);

  const lines = [
    `URL: ${location.pathname}${location.search}`,
    headings.length ? `Headings: ${headings.join(" / ")}` : "",
    "Interactive elements:",
    ...chosen.map((el) => describeElement(el, stampId(el))),
    omitted ? `(${omitted} more elements further down — scroll to reach them)` : "",
    alerts.length ? `Alerts: ${alerts.join(" | ")}` : "",
    "Page text:",
    mainText(SNAPSHOT_TEXT_CHARS),
  ];
  return lines.filter(Boolean).join("\n");
}

function findById(id: unknown): Element | null {
  const n = Number(id);
  if (!Number.isInteger(n)) return null;
  const el = document.querySelector(`[${ID_ATTR}="${n}"]`);
  return el && isVisible(el) ? el : null;
}

/** What's in the form a commit button belongs to — shown on the approval card so the user approves real values, not the model's paraphrase. */
function describeForm(el: Element): FormField[] {
  const form = (el as HTMLButtonElement).form ?? el.closest("form");
  if (!form) return [];
  const fields: FormField[] = [];
  for (const f of Array.from(form.elements)) {
    if (!isFormControl(f) || !isVisible(f)) continue;
    if (f instanceof HTMLInputElement && ["submit", "button", "file", "password", "hidden"].includes(f.type)) continue;
    let value: string;
    if (f instanceof HTMLSelectElement) {
      if (f.selectedIndex <= 0 && f.options[0]?.value === "") continue; // still on the placeholder
      value = f.selectedOptions[0]?.text ?? "";
    } else if (f instanceof HTMLInputElement && (f.type === "checkbox" || f.type === "radio")) {
      if (!f.checked) continue;
      value = "Yes";
    } else {
      value = f.value;
    }
    value = clean(value, 120);
    if (value) fields.push({ label: clean(labelFor(f), 60) || f.name, value });
  }
  for (const line of (form as HTMLElement).innerText.split("\n")) {
    const m = /^(Subtotal|Tax|Total|Refund total)\s+(.*\d.*)$/i.exec(line.trim());
    if (m) fields.push({ label: m[1], value: m[2].trim() });
  }
  return fields.slice(0, 18);
}

/** Waits for a click/navigation to land: an optional URL change, then a quiet DOM (ignoring Vita's own UI). */
async function settle(prevHref: string, navWaitMs: number) {
  await sleep(120);
  const start = Date.now();
  while (location.href === prevHref && Date.now() - start < navWaitMs) await sleep(100);
  await new Promise<void>((resolve) => {
    let quiet = window.setTimeout(finish, 300);
    const max = window.setTimeout(finish, 2500);
    const observer = new MutationObserver((records) => {
      if (records.every((r) => insideVita(r.target))) return;
      window.clearTimeout(quiet);
      quiet = window.setTimeout(finish, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    function finish() {
      observer.disconnect();
      window.clearTimeout(quiet);
      window.clearTimeout(max);
      resolve();
    }
  });
}

/** Native constraint validation for the form a submit button belongs to — so we never ask approval for a form that can't submit. */
function formProblems(el: Element): string[] {
  const form = (el as HTMLButtonElement).form;
  if (!form || form.checkValidity()) return [];
  return Array.from(form.elements)
    .filter((f): f is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => isFormControl(f) && !f.checkValidity())
    .map((f) => `${clean(labelFor(f), 40) || f.name}: ${f.validationMessage}`);
}

/**
 * After a submit, wait for the save to actually finish: the page navigates, the
 * button goes away, or it re-enables after its pending state (useActionState
 * disables it while the server action runs). Dev-mode compiles can make this slow.
 */
async function waitForSubmit(button: HTMLButtonElement | HTMLInputElement, prevHref: string): Promise<"navigated" | "done" | "timeout"> {
  const start = Date.now();
  let sawPending = false;
  while (Date.now() - start < 30_000) {
    if (location.href !== prevHref || !button.isConnected) return "navigated";
    if (button.disabled || button.getAttribute("aria-busy") === "true") sawPending = true;
    else if (sawPending || Date.now() - start > 1500) return "done";
    await sleep(150);
  }
  return "timeout";
}

function performClick(el: HTMLElement) {
  const opts = { bubbles: true, cancelable: true, view: window };
  el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerType: "mouse" }));
  el.dispatchEvent(new MouseEvent("mousedown", opts));
  el.focus({ preventScroll: true });
  el.dispatchEvent(new PointerEvent("pointerup", { ...opts, pointerType: "mouse" }));
  el.dispatchEvent(new MouseEvent("mouseup", opts));
  el.click();
}

// React tracks input values itself; going through the native setter + an `input` event is what makes it see the change.
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9.$ ]+/g, " ").replace(/\s+/g, " ").trim();
}

function matchOption(select: HTMLSelectElement, wanted: string): HTMLOptionElement | null {
  const w = norm(wanted);
  if (!w) return null;
  const options = Array.from(select.options);
  return (
    options.find((o) => o.value === wanted) ??
    options.find((o) => norm(o.text) === w) ??
    options.find((o) => o.value !== "" && norm(o.text).includes(w)) ??
    options.find((o) => o.value !== "" && norm(o.text).length > 2 && w.includes(norm(o.text))) ??
    null
  );
}

function pathOf(href: string) {
  const url = new URL(href, location.origin);
  return `${url.pathname}${url.search}`;
}

/** A short, specific caption for a pending call — used on the cursor and in the step log. */
export function describeUiCall(name: UiToolName, args: Record<string, unknown>): string {
  const say = typeof args.say === "string" ? args.say.trim() : "";
  if (say) return say;
  const el = "id" in args ? findById(args.id) : null;
  const label = el ? clean(labelFor(el), 40) : "";
  switch (name) {
    case "click":
      return label ? `Clicking “${label}”` : "Clicking";
    case "type_text":
      return `Typing “${clean(String(args.text ?? ""), 30)}”${label ? ` in ${label}` : ""}`;
    case "select_option":
      return `Choosing “${clean(String(args.option ?? ""), 30)}”${label ? ` for ${label}` : ""}`;
    case "navigate":
      return `Opening ${String(args.path ?? "")}`;
    case "scroll":
      return `Scrolling ${args.direction === "up" ? "up" : "down"}`;
    case "read_page":
      return "Reading the page";
  }
}

export async function executeUiTool(name: UiToolName, args: Record<string, unknown>, hooks: ExecHooks): Promise<UiResult> {
  if (hooks.isStopped()) return { ok: false, message: "Stopped by the user." };
  const caption = describeUiCall(name, args);
  const say = typeof args.say === "string" ? args.say.trim() : "";
  if (say) hooks.narrate(say);

  switch (name) {
    case "click": {
      const el = findById(args.id);
      if (!el) return { ok: false, message: `There's no element [${String(args.id)}] on the page right now.` };
      if ((el as HTMLButtonElement).disabled) {
        return { ok: false, message: "That button is disabled — a required field is probably empty or invalid." };
      }
      await vitaCursor.moveTo(el, caption);

      const problems = isSubmitControl(el) ? formProblems(el) : [];
      if (problems.length > 0) {
        vitaCursor.clearHighlight();
        return { ok: false, message: `The form can't be submitted yet — ${problems.join("; ")}.` };
      }

      if (needsApproval(el)) {
        const label = clean(labelFor(el), 40);
        const summary = typeof args.summary === "string" && args.summary.trim() ? args.summary.trim() : say || `Click “${label}”`;
        const request = { summary, fields: describeForm(el) };
        vitaCursor.setCaption("Waiting for your OK");
        const approved = await hooks.requestApproval(request);
        if (!approved || hooks.isStopped()) {
          vitaCursor.clearHighlight();
          return { ok: false, message: "The user declined this action. Don't retry it unless they ask." };
        }
        hooks.onApproved(request);
        vitaCursor.setCaption(caption);
        // The page may have shifted while the approval card was up.
        if (!findById(args.id)) return { ok: false, message: "The button disappeared while waiting for approval." };
        await vitaCursor.moveTo(el, caption);
      }

      const prevHref = location.href;
      await vitaCursor.click();
      performClick(el as HTMLElement);

      if (isSubmitControl(el)) {
        vitaCursor.setCaption("Saving…");
        const outcome = await waitForSubmit(el as HTMLButtonElement, prevHref);
        await settle(prevHref, 0);
        vitaCursor.clearHighlight();
        if (outcome === "timeout") {
          return { ok: false, message: "Submitted, but the page is still saving after 30 seconds — don't claim success; tell the user it's still saving." };
        }
        return {
          ok: true,
          message:
            location.href !== prevHref
              ? `Submitted. Now on ${location.pathname}${location.search}.`
              : "Submitted. The page didn't navigate — check the snapshot's alerts/text for a success or error message before reporting.",
        };
      }

      await settle(prevHref, el instanceof HTMLAnchorElement ? 6000 : 600);
      vitaCursor.clearHighlight();
      return {
        ok: true,
        message: location.href !== prevHref ? `Clicked. Now on ${location.pathname}${location.search}.` : "Clicked.",
      };
    }

    case "type_text": {
      const el = findById(args.id);
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
        return { ok: false, message: `[${String(args.id)}] isn't a text field I can type into.` };
      }
      if (el instanceof HTMLInputElement && ["checkbox", "radio", "file", "submit", "button"].includes(el.type)) {
        return { ok: false, message: "That's not a typeable field — use click instead." };
      }
      const text = String(args.text ?? "");
      await vitaCursor.moveTo(el, caption);
      await vitaCursor.click();
      el.focus({ preventScroll: true });

      const charByChar = el instanceof HTMLTextAreaElement || CHAR_TYPED_INPUTS.has(el.type);
      if (charByChar && text.length > 0) {
        // Visible typing, capped so long text never takes more than ~0.8s.
        const step = Math.max(1, Math.ceil(text.length / 40));
        for (let i = step; i < text.length + step; i += step) {
          setNativeValue(el, text.slice(0, Math.min(i, text.length)));
          await sleep(18);
        }
      } else {
        setNativeValue(el, text);
      }
      el.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(80);
      vitaCursor.clearHighlight();

      if (text && !el.value) {
        return { ok: false, message: `The field rejected “${text}”. Check the expected format (dates are YYYY-MM-DD, numbers without symbols).` };
      }
      return { ok: true, message: el.value === text ? "Typed." : `Typed. The field now shows “${el.value}”.` };
    }

    case "select_option": {
      const el = findById(args.id);
      if (!(el instanceof HTMLSelectElement)) return { ok: false, message: `[${String(args.id)}] isn't a dropdown.` };
      const option = matchOption(el, String(args.option ?? ""));
      if (!option) {
        const choices = Array.from(el.options)
          .slice(0, 30)
          .map((o) => `"${clean(o.text, 40)}"`)
          .join(", ");
        return { ok: false, message: `No option matches “${String(args.option)}”. Options are: ${choices}.` };
      }
      await vitaCursor.moveTo(el, caption);
      await vitaCursor.click();
      el.focus({ preventScroll: true });
      setNativeValue(el, option.value);
      el.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(150);
      vitaCursor.clearHighlight();
      return { ok: true, message: `Selected “${clean(option.text, 60)}”.` };
    }

    case "navigate": {
      const raw = String(args.path ?? "");
      let url: URL;
      try {
        url = new URL(raw, location.origin);
      } catch {
        return { ok: false, message: `“${raw}” isn't a valid path.` };
      }
      if (!raw.startsWith("/") || raw.startsWith("//") || url.origin !== location.origin) {
        return { ok: false, message: "I can only open pages inside VitaCount (paths starting with '/')." };
      }
      const target = `${url.pathname}${url.search}`;
      const prevHref = location.href;
      const findLink = () =>
        Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).find((a) => isVisible(a) && pathOf(a.href) === target);

      // Get there the way a person would, so the user sees it: a visible link, else a link inside a
      // top-bar menu (e.g. New → Expense), else a direct route change.
      let link = findLink();
      if (!link) {
        const menus = Array.from(document.querySelectorAll<HTMLElement>('header [aria-expanded="false"][aria-controls]')).filter(isVisible);
        for (const menu of menus) {
          await vitaCursor.moveTo(menu, caption);
          await vitaCursor.click();
          performClick(menu);
          await sleep(220);
          link = findLink();
          if (link) break;
          performClick(menu); // not in this menu — close it again
          await sleep(120);
        }
      }
      if (link) {
        await vitaCursor.moveTo(link, caption);
        await vitaCursor.click();
        performClick(link);
      } else {
        vitaCursor.setCaption(caption);
        hooks.navigate(target);
      }
      await settle(prevHref, 6000);
      vitaCursor.clearHighlight();
      return { ok: true, message: `Now on ${location.pathname}${location.search}.` };
    }

    case "scroll": {
      vitaCursor.setCaption(caption);
      window.scrollBy({ top: (args.direction === "up" ? -1 : 1) * window.innerHeight * 0.8, behavior: "smooth" });
      await sleep(500);
      return { ok: true, message: "Scrolled." };
    }

    case "read_page": {
      vitaCursor.setCaption(caption);
      return { ok: true, message: `Full page text:\n${mainText(READ_PAGE_CHARS)}` };
    }
  }
}
