"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, Select, SubmitButton } from "@/components/ui/field";
import { useActionForm, type FieldErrors } from "@/components/forms/use-action-form";
import { createAccountAction, type CreateAccountState } from "@/lib/actions/accounts";

const initialState: CreateAccountState = { error: null };

const TYPES = [
  { value: "asset", label: "Asset", range: "1000–1999" },
  { value: "liability", label: "Liability", range: "2000–2999" },
  { value: "equity", label: "Equity", range: "3000–3999" },
  { value: "revenue", label: "Revenue", range: "4000–4999" },
  { value: "expense", label: "Expense", range: "5000–9999" },
] as const;

export function NewAccountForm({ tenantId }: { tenantId: string }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("expense");

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!code.trim()) found.code = "Enter an account code.";
    if (!name.trim()) found.name = "Enter an account name.";
    return found;
  }

  const { state, pending, errors, formProps } = useActionForm(createAccountAction.bind(null, tenantId), initialState, validate);

  // clear the fields once an account is added, ready for the next one
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.created) {
      setCode("");
      setName("");
    }
  }

  const range = TYPES.find((t) => t.value === type)?.range;

  return (
    <form {...formProps} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[9rem_10rem_minmax(0,1fr)_auto] sm:items-start">
        <Field label="Type" htmlFor="type" error={errors.type}>
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Code" htmlFor="code" required error={errors.code} hint={range ? `Usually ${range}.` : undefined}>
          <Input
            id="code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={errors.code ? true : undefined}
            autoComplete="off"
            placeholder="6150"
            className="h-9 font-mono tabular-nums"
          />
        </Field>
        <Field label="Name" htmlFor="name" required error={errors.name}>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            autoComplete="off"
            placeholder="e.g. Software subscriptions"
            className="h-9"
          />
        </Field>
        <div className="sm:pt-[22px]">
          <SubmitButton pending={pending} pendingLabel="Adding…" className="w-full sm:w-auto">
            Add account
          </SubmitButton>
        </div>
      </div>
      {state.error ? <FormMessage>{state.error}</FormMessage> : state.created ? <FormMessage tone="success">Added {state.created}.</FormMessage> : null}
    </form>
  );
}
