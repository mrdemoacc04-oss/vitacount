"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-card pl-3.5 pr-11 text-[15px] text-foreground shadow-soft-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

function strength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const score = (pw.length < 8 ? 1 : Math.max(1, s)) as 1 | 2 | 3 | 4;
  return { score, label: pw.length < 8 ? "Too short" : ["", "Weak", "Fair", "Good", "Strong"][score] };
}

/** Password field with a show/hide toggle and, for new passwords, a strength meter. */
export function PasswordInput({
  id,
  name = "password",
  autoComplete,
  showStrength = false,
  minLength,
  invalid,
}: {
  id: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  showStrength?: boolean;
  minLength?: number;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const meterId = useId();
  const { score, label } = strength(value);

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={showStrength ? meterId : undefined}
          className={cn(inputClass, invalid && "border-destructive")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
      {showStrength && (
        <div id={meterId} className="mt-2 flex items-center gap-3" aria-live="polite">
          <div className="grid flex-1 grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full transition-colors duration-200",
                  i <= score
                    ? score <= 1
                      ? "bg-destructive"
                      : score === 2
                        ? "bg-warning"
                        : "bg-positive"
                    : "bg-muted",
                )}
              />
            ))}
          </div>
          <span className="w-24 whitespace-nowrap text-right text-xs text-muted-foreground">{label || "8+ characters"}</span>
        </div>
      )}
    </div>
  );
}

export const authInputClass =
  "h-11 w-full rounded-lg border border-input bg-card px-3.5 text-[15px] text-foreground shadow-soft-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive";
