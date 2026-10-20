"use client";

import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/field";
import { ROLES, ROLE_BADGE, ROLE_LABEL, initials, isRole, type Role } from "@/components/settings/options";
import { changeMemberRoleAction, removeMemberAction } from "@/lib/actions/team";
import { formatDate } from "@/lib/dates";

export type TeamMember = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  /** membership created / invite sent, ISO timestamp */
  joinedAt: string | null;
};

export function MembersTable({
  tenantId,
  members,
  currentUserId,
  viewerRole,
}: {
  tenantId: string;
  members: TeamMember[];
  currentUserId: string;
  viewerRole: string | null;
}) {
  const activeOwners = members.filter((m) => m.role === "owner" && m.status === "active").length;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft-sm">
      <div
        className="hidden grid-cols-[minmax(0,1fr)_132px_76px_92px_88px] items-center gap-4 border-b border-border bg-surface/60 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:grid"
        aria-hidden="true"
      >
        <span>Member</span>
        <span>Role</span>
        <span>Status</span>
        <span>Joined</span>
        <span className="sr-only">Actions</span>
      </div>
      <ul className="divide-y divide-border" aria-label="Team members">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            tenantId={tenantId}
            member={member}
            isSelf={member.userId === currentUserId}
            viewerRole={viewerRole}
            isLastOwner={member.role === "owner" && member.status === "active" && activeOwners <= 1}
          />
        ))}
      </ul>
    </div>
  );
}

function MemberRow({
  tenantId,
  member,
  isSelf,
  viewerRole,
  isLastOwner,
}: {
  tenantId: string;
  member: TeamMember;
  isSelf: boolean;
  viewerRole: string | null;
  isLastOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // shows the new role while the change saves; falls back to the server's value after
  const [shownRole, setShownRole] = useOptimistic(member.role);

  const viewerIsOwner = viewerRole === "owner";
  const canManage = viewerIsOwner || viewerRole === "admin";
  // Admins manage everyone except owners; only owners touch owner roles.
  const canEditRow = canManage && (viewerIsOwner || member.role !== "owner");
  const roleChoices: readonly Role[] = viewerIsOwner ? ROLES : ROLES.filter((r) => r !== "owner");
  const role = isRole(shownRole) ? shownRole : null;
  const invited = member.status !== "active";
  const displayName = member.name?.trim() || member.email || "Pending invite";
  const removeLabel = isSelf ? "Leave" : invited ? "Revoke" : "Remove";

  function changeRole(next: string) {
    setError(null);
    startTransition(async () => {
      setShownRole(next);
      const result = await changeMemberRoleAction(tenantId, member.id, next);
      if (result.error) setError(result.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(tenantId, member.id);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <li className={cn("px-5 py-3.5 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 md:grid-cols-[minmax(0,1fr)_132px_76px_92px_88px]">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
              invited ? "border border-dashed border-border text-muted-foreground" : "bg-primary/10 text-primary",
            )}
          >
            {initials(member.name, member.email)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-foreground">
              {displayName}
              {isSelf && <span className="ml-1.5 font-normal text-muted-foreground">(you)</span>}
            </p>
            {member.email && member.name?.trim() ? <p className="truncate text-xs text-muted-foreground">{member.email}</p> : null}
          </div>
        </div>

        <div className="col-span-2 row-start-2 flex flex-wrap items-center gap-2 md:contents">
          <div>
            {canEditRow && !isLastOwner ? (
              <Select
                aria-label={`Role for ${displayName}`}
                value={role ?? ""}
                disabled={pending}
                onChange={(e) => changeRole(e.target.value)}
                className="h-8 w-[132px] text-[13px]"
              >
                {role === null && <option value="">{member.role}</option>}
                {roleChoices.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            ) : (
              <span
                className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", role ? ROLE_BADGE[role] : "bg-muted text-muted-foreground")}
                title={canEditRow && isLastOwner ? "Every workspace needs at least one owner" : undefined}
              >
                {role ? ROLE_LABEL[role] : member.role}
              </span>
            )}
          </div>

          <div>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                invited ? "bg-warning/12 text-warning" : "bg-positive/10 text-positive",
              )}
            >
              {invited ? "Invited" : "Active"}
            </span>
          </div>

          <p className="text-[13px] tabular-nums text-muted-foreground">
            <span className="md:sr-only">{invited ? "Invited " : "Joined "}</span>
            {member.joinedAt ? formatDate(member.joinedAt.slice(0, 10)) : "—"}
          </p>
        </div>

        <div className="col-start-2 row-start-1 flex justify-end md:col-start-auto md:row-start-auto">
          {canEditRow && !isLastOwner && !confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={pending}
              className="h-8 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-destructive/[0.07] hover:text-destructive disabled:opacity-60"
            >
              {removeLabel}
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div
          role="alertdialog"
          aria-label={`${removeLabel} ${displayName}`}
          className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.05] px-3.5 py-2.5"
        >
          <p className="text-[13px] text-foreground">
            {isSelf
              ? "Leave this workspace? You'll lose access until someone invites you again."
              : invited
                ? `Revoke the invitation for ${displayName}? They won't be able to join with the link in their email.`
                : `Remove ${displayName}? They'll lose access to this workspace right away. Their past work stays in the books.`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="h-8 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground shadow-soft-sm transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              autoFocus
              className="h-8 rounded-lg bg-destructive px-3 text-[13px] font-medium text-white shadow-soft-sm transition-colors hover:bg-destructive/90 disabled:opacity-60"
            >
              {pending ? "Working…" : removeLabel}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
