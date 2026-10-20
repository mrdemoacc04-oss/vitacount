"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useState, type FormEvent } from "react";

/** What every form action returns: a form-level message and/or messages keyed by field. */
export type FormState = { error: string | null; fieldErrors?: Record<string, string> };
export type FieldErrors = Record<string, string>;

/** First focusable control inside an invalid field, in document order. */
const INVALID_CONTROL =
  '[aria-invalid="true"], [data-invalid] input:not([type="hidden"]), [data-invalid] select, [data-invalid] textarea, [data-invalid] button[role="combobox"]';

/**
 * useActionState plus the behaviour every form here wants:
 *  - client-side validation before anything is sent (`validate`)
 *  - server `fieldErrors` merged with client ones, each cleared as its field is edited
 *  - the first invalid field focused after a failed submit
 *  - a `dirty` flag (any edit) for the discard-changes confirmation
 *
 * Submitting goes through onSubmit + startTransition rather than `<form action>`,
 * so React doesn't reset the inputs when the server sends back an error.
 */
export function useActionForm<S extends FormState>(
  action: (prev: Awaited<S>, formData: FormData) => Promise<S>,
  initialState: Awaited<S>,
  validate?: (formData: FormData) => FieldErrors | null | undefined,
) {
  const [state, formAction, pending] = useActionState<S, FormData>(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dirty, setDirty] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // A new server result replaces the field errors (adjusting state during render,
  // React's recommended alternative to syncing it in an effect).
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    setErrors(state.fieldErrors ?? {});
    setAttempt((n) => n + 1);
  }

  useEffect(() => {
    if (attempt === 0) return;
    const target = formRef.current?.querySelector<HTMLElement>(INVALID_CONTROL);
    if (target) {
      target.focus();
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [attempt]);

  const clearError = useCallback((key: string) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const setFieldError = useCallback((key: string, message: string) => {
    setErrors((prev) => ({ ...prev, [key]: message }));
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    const found = validate?.(formData) ?? {};
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setAttempt((n) => n + 1);
      return;
    }
    setErrors({});
    startTransition(() => formAction(formData));
  }

  /** Any edit marks the form dirty and clears the edited field's error (by `data-field`, then `name`). */
  function onChange(event: FormEvent<HTMLFormElement>) {
    setDirty(true);
    const target = event.target as HTMLElement & { name?: string };
    const key = target.dataset?.field ?? target.name;
    if (key) clearError(key);
  }

  return {
    state,
    pending,
    errors,
    dirty,
    setDirty,
    clearError,
    setFieldError,
    formProps: { ref: formRef, onSubmit, onChange, noValidate: true } as const,
  };
}

/** Warns before the tab is closed or reloaded with unsaved edits. */
export function useUnsavedChangesWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}
