"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { signOut } from "@/lib/actions/auth";
import { switchTenantAction } from "@/lib/tenant/actions";
import { useTenant } from "@/lib/tenant/context";
import { NAV_GROUPS, activeNavHref, type NavItem } from "@/lib/navigation";
import { useDismiss } from "@/lib/use-dismiss";
import { Icons } from "@/components/icons";
import { LogoMark } from "@/components/logo-mark";

const STORAGE_KEY = "vitacount:sidebar-collapsed";

function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`nav-motion group flex h-8 items-center gap-2.5 rounded-lg text-[13px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring ${
        collapsed ? "justify-center px-0" : "px-2.5"
      } ${
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
      }`}
    >
      <Icon
        className={`size-[17px] shrink-0 transition-colors duration-150 ${
          active ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"
        }`}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function WorkspaceMenu({ collapsed }: { collapsed: boolean }) {
  const { activeTenantId, activeTenant, memberships } = useTenant();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const name = activeTenant?.name ?? memberships[0]?.tenant?.name ?? "Untitled workspace";
  const canSwitch = memberships.length > 1;

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => canSwitch && setOpen((v) => !v)}
        aria-expanded={canSwitch ? open : undefined}
        aria-haspopup={canSwitch ? "menu" : undefined}
        title={collapsed ? name : undefined}
        className={`flex h-9 w-full min-w-0 items-center gap-2.5 rounded-lg outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring ${
          collapsed ? "justify-center" : "px-1.5"
        } ${canSwitch ? "hover:bg-sidebar-accent/60" : "cursor-default"}`}
      >
        <LogoMark className="size-6 shrink-0" />
        {!collapsed && (
          <>
            <span className={`min-w-0 flex-1 truncate text-left text-[13px] font-semibold tracking-tight ${pending ? "opacity-60" : ""}`}>
              {name}
            </span>
            {canSwitch && <Icons.chevronUpDown className="size-3.5 shrink-0 text-muted-foreground" />}
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`animate-pop-in absolute left-0 z-50 mt-1 rounded-xl border border-border bg-popover p-1 shadow-soft ${
            collapsed ? "w-60" : "right-0"
          }`}
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">Workspaces</p>
          {memberships.map((m) => {
            const active = m.tenant_id === activeTenantId;
            return (
              <button
                key={m.tenant_id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  if (active) return;
                  startTransition(async () => {
                    await switchTenantAction(m.tenant_id);
                    router.refresh();
                  });
                }}
                className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-accent"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
                  {(m.tenant?.name ?? "U").charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.tenant?.name ?? "Untitled workspace"}</span>
                {active && <Icons.check className="size-3.5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  // The persisted theme is only known on the client; render a neutral state until then.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const current = mounted ? resolvedTheme : undefined;

  return (
    <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
      <span className="text-[13px] text-foreground">Appearance</span>
      <div role="radiogroup" aria-label="Appearance" className="flex rounded-lg bg-muted p-0.5">
        {(
          [
            { value: "light", label: "Light", Icon: Icons.sun },
            { value: "dark", label: "Dark", Icon: Icons.moon },
          ] as const
        ).map(({ value, label, Icon }) => {
          const on = current === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              title={label}
              onClick={() => setTheme(value)}
              className={`flex size-6 items-center justify-center rounded-md transition-all duration-150 ${
                on ? "bg-card text-foreground shadow-soft-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AccountMenu({ fullName, email, collapsed }: { fullName: string | null; email: string | null; collapsed: boolean }) {
  const { role } = useTenant();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const display = fullName ?? email ?? "Your account";

  return (
    <div ref={ref} className="relative">
      {open && (
        <div
          role="menu"
          className="animate-pop-in-up absolute bottom-full left-0 z-50 mb-1.5 w-64 rounded-xl border border-border bg-popover p-1 shadow-soft"
        >
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="truncate text-[13px] font-medium text-foreground">{display}</p>
            {email && fullName && <p className="truncate text-xs text-muted-foreground">{email}</p>}
          </div>
          <div className="my-1 h-px bg-border" />
          {[
            { href: "/settings/profile", label: "Your profile", Icon: Icons.contacts },
            { href: "/settings", label: "Workspace settings", Icon: Icons.settings },
            { href: "/team", label: "Team", Icon: Icons.team },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-foreground transition-colors duration-150 hover:bg-accent"
            >
              <Icon className="size-4 text-muted-foreground" />
              {label}
            </Link>
          ))}
          <ThemeSwitch />
          <div className="my-1 h-px bg-border" />
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-foreground transition-colors duration-150 hover:bg-accent"
            >
              <Icons.logout className="size-4 text-muted-foreground" />
              Log out
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={collapsed ? display : undefined}
        className={`flex h-10 w-full items-center gap-2.5 rounded-lg outline-none transition-colors duration-150 hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-ring ${
          collapsed ? "justify-center" : "px-1.5"
        } ${open ? "bg-sidebar-accent/60" : ""}`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[9px] bg-primary text-[10.5px] font-semibold tracking-wide text-primary-foreground">
          {initials(fullName ?? email)}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="block truncate text-[13px] font-medium text-foreground">{display}</span>
              {role && <span className="block truncate text-[11.5px] capitalize text-muted-foreground">{role}</span>}
            </span>
            <Icons.chevronUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>
    </div>
  );
}

export function SidebarIconButton({ onClick, label, icon }: { onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-foreground"
    >
      {icon}
    </button>
  );
}

/** Everything inside the sidebar — rendered by the desktop rail and the mobile drawer alike. */
export function SidebarContent({
  fullName,
  email,
  collapsed = false,
  headerAction,
  onNavigate,
}: {
  fullName: string | null;
  email: string | null;
  collapsed?: boolean;
  /** the button beside the workspace switcher — collapse on desktop, close in the drawer */
  headerAction?: ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activeHref = activeNavHref(pathname);

  return (
    <div className="flex h-full flex-col">
      <div className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
        <WorkspaceMenu collapsed={collapsed} />
        {headerAction}
      </div>

      <nav aria-label="Main" className="scrollbar-none -mx-1 mt-4 flex flex-1 flex-col gap-4 overflow-y-auto px-1 pb-4">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label ?? i} className="flex flex-col gap-px">
            {group.label &&
              (collapsed ? (
                <div className="mx-auto mb-1 h-px w-5 bg-sidebar-border" aria-hidden="true" />
              ) : (
                <p className="mb-1 px-2.5 text-[11.5px] font-medium text-muted-foreground/70">{group.label}</p>
              ))}
            {group.items.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                active={activeHref === item.href}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border pt-2">
        <AccountMenu fullName={fullName} email={email} collapsed={collapsed} />
      </div>
    </div>
  );
}

/** The desktop rail. Collapsing is remembered per browser. */
export function Sidebar({ fullName, email }: { fullName: string | null; email: string | null }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a persisted UI preference on mount; client-only to avoid an SSR hydration mismatch.
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage unavailable — keep default expanded state.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar py-3 transition-[width] duration-200 ease-out md:flex ${
        collapsed ? "w-[60px] px-2" : "w-60 px-3"
      }`}
    >
      <SidebarContent
        fullName={fullName}
        email={email}
        collapsed={collapsed}
        headerAction={
          <SidebarIconButton
            onClick={toggleCollapsed}
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            icon={<Icons.sidebar className="size-[17px]" />}
          />
        }
      />
    </aside>
  );
}
