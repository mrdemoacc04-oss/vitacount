"use client";

import Link from "next/link";
import { Field, Select } from "@/components/ui/field";
import type { ProjectOption } from "@/components/forms/catalog";

const label = (p: ProjectOption) => (p.code ? `${p.code} · ${p.name}` : p.name);

/**
 * Optional project tag for a transaction. Active projects only; when a customer is
 * chosen, that customer's projects are listed first. Renders nothing when the
 * workspace has no projects table yet (`projects === null`).
 */
export function ProjectSelect({
  projects,
  value,
  onChange,
  customerId,
  error,
  id = "projectId",
  hint,
  className,
}: {
  projects: ProjectOption[] | null;
  value: string;
  onChange: (value: string) => void;
  customerId?: string;
  error?: string;
  id?: string;
  hint?: string;
  className?: string;
}) {
  if (projects === null) return null;

  const own = customerId ? projects.filter((p) => p.customerId === customerId) : [];
  const others = customerId ? projects.filter((p) => p.customerId !== customerId) : projects;

  return (
    <Field
      label="Project"
      htmlFor={id}
      optional
      error={error}
      className={className}
      hint={
        projects.length === 0 ? (
          <>
            No active projects yet.{" "}
            <Link href="/projects" className="font-medium text-primary hover:underline">
              Create one
            </Link>{" "}
            to track profit by job.
          </>
        ) : (
          (hint ?? "Tag it to a job to see that project's profit.")
        )
      }
    >
      <Select
        id={id}
        name="projectId"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={projects.length === 0}
        aria-invalid={error ? true : undefined}
      >
        <option value="">No project</option>
        {own.length > 0 ? (
          <>
            <optgroup label="This customer's projects">
              {own.map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p)}
                </option>
              ))}
            </optgroup>
            {others.length > 0 && (
              <optgroup label="Other projects">
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {label(p)}
                  </option>
                ))}
              </optgroup>
            )}
          </>
        ) : (
          others.map((p) => (
            <option key={p.id} value={p.id}>
              {label(p)}
            </option>
          ))
        )}
      </Select>
    </Field>
  );
}
