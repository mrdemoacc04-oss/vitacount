import type { ReactNode, SVGProps } from "react";

/**
 * VitaCount's icon set — one 24px grid, 1.5 stroke, round caps and joins.
 * Hand-drawn rather than pulled from an icon library so the shell has its own voice.
 *
 * The nav icons tag their moving parts with `im-*` classes; globals.css animates
 * them on sidebar hover / activation (see "Sidebar icon motion"). At rest they draw
 * exactly as a plain icon, so they're safe to use anywhere.
 */
export type Icon = (props: SVGProps<SVGSVGElement>) => ReactNode;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function icon(children: ReactNode): Icon {
  return function SvgIcon(p) {
    return (
      <svg {...base} {...p}>
        {children}
      </svg>
    );
  };
}

export const Icons = {
  dashboard: icon(
    <>
      <rect className="im-tile" x="3.5" y="3.5" width="7" height="9" rx="1.5" />
      <rect className="im-tile" x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect className="im-tile" x="3.5" y="15.5" width="7" height="5" rx="1.5" />
      <rect className="im-tile" x="13.5" y="11.5" width="7" height="9" rx="1.5" />
    </>,
  ),
  transactions: icon(
    <>
      <path className="im-nudge-r" d="M4 8h13l-3-3" />
      <path className="im-nudge-l" d="M20 16H7l3 3" />
    </>,
  ),
  sales: icon(<path className="im-shoot-ur" d="M5 19 19 5M9 5h10v10" />),
  expenses: icon(<path className="im-shoot-dl" d="M19 5 5 19M15 19H5V9" />),
  banking: icon(
    <>
      <path className="im-lift" d="M3.5 9.5 12 4l8.5 5.5" />
      <path className="im-grow" d="M5.5 10v7" />
      <path className="im-grow" d="M10 10v7" />
      <path className="im-grow" d="M14 10v7" />
      <path className="im-grow" d="M18.5 10v7" />
      <path d="M3.5 19.5h17" />
    </>,
  ),
  reconciliation: icon(
    <>
      <path className="im-nudge-l" d="M8 7.5h11M8 7.5l3-3M8 7.5l3 3" />
      <path className="im-nudge-r" d="M16 16.5H5M16 16.5l-3-3M16 16.5l-3 3" />
    </>,
  ),
  projects: icon(
    <>
      <path
        className="im-wiggle"
        d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z"
      />
    </>,
  ),
  inventory: icon(
    <>
      <g className="im-hop">
        <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4Z" />
        <path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9" />
      </g>
    </>,
  ),
  contacts: icon(
    <>
      <circle className="im-nod" cx="12" cy="9" r="3.5" />
      <path d="M5 19.5c.8-3 3.6-5 7-5s6.2 2 7 5" />
    </>,
  ),
  documents: icon(
    <>
      <path d="M7 3.5h7L18.5 8V19.5a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5V8h4.5" />
      <path className="im-write" pathLength={1} d="M9 13h6" />
      <path className="im-write" pathLength={1} d="M9 16.5h4" />
    </>,
  ),
  reports: icon(
    <>
      <path className="im-grow" d="M5.5 19.5V11" />
      <path className="im-grow" d="M12 19.5v-15" />
      <path className="im-grow" d="M18.5 19.5V14" />
    </>,
  ),
  forecasting: icon(<path d="M3.5 17 9 11.5l4 4 7.5-8.5M20.5 7v5M20.5 7h-5" />),
  agents: icon(
    <>
      <path className="im-rays" d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
      <path className="im-spin" d="M12 8.5 13.2 10.8 15.5 12l-2.3 1.2L12 15.5l-1.2-2.3L8.5 12l2.3-1.2Z" />
    </>,
  ),
  ledger: icon(
    <>
      <g className="im-tilt">
        <path d="M5.5 4.5h11a2 2 0 0 1 2 2v13h-11a2 2 0 0 1-2-2Z" />
        <path d="M5.5 17.5a2 2 0 0 1 2-2h11" />
        <path className="im-write" pathLength={1} d="M9.5 8.5h5" />
      </g>
    </>,
  ),
  accounts: icon(
    <>
      <path className="im-row" d="M4.5 6.5h15" />
      <path className="im-row" d="M4.5 12h15" />
      <path className="im-row" d="M4.5 17.5h15" />
      <path d="M9.5 4v16" />
    </>,
  ),
  settings: icon(
    <>
      {/* each track is one line with a dash gap around its knob, so the gap can follow the knob */}
      <path className="im-track-a" d="M4.5 7.5h15" strokeDasharray="9 4 2 100" />
      <path className="im-track-b" d="M4.5 16.5h15" strokeDasharray="2 4 9 100" />
      <circle className="im-knob-a" cx="15.5" cy="7.5" r="2" />
      <circle className="im-knob-b" cx="8.5" cy="16.5" r="2" />
    </>,
  ),
  logout: icon(<path d="M9.5 20H6a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 6 4h3.5M15.5 16l4-4-4-4M19.5 12h-10" />),
  search: icon(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>,
  ),
  plus: icon(<path d="M12 5v14M5 12h14" />),
  check: icon(<path d="m5 12.5 4.5 4.5L19 7.5" />),
  close: icon(<path d="M6 6l12 12M18 6 6 18" />),
  menu: icon(<path d="M4 8h16M4 16h16" />),
  chevronDown: icon(<path d="m7 10 5 5 5-5" />),
  chevronRight: icon(<path d="m10 7 5 5-5 5" />),
  chevronUpDown: icon(<path d="m8 15 4 4 4-4M8 9l4-4 4 4" />),
  sidebar: icon(
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9.5 4.5v15" />
    </>,
  ),
  arrowRight: icon(<path d="M5 12h14M13 6l6 6-6 6" />),
  arrowUpRight: icon(<path d="M7 17 17 7M8 7h9v9" />),
  sun: icon(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>,
  ),
  moon: icon(<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />),
  invoice: icon(
    <>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 8.5h6M9 12h6" />
    </>,
  ),
  receipt: icon(
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" />
    </>,
  ),
  coinIn: icon(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v8M8.5 12.5 12 16l3.5-3.5" />
    </>,
  ),
  coinOut: icon(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 16V8M8.5 11.5 12 8l3.5 3.5" />
    </>,
  ),
  refund: icon(<path d="M9 14 4.5 9.5 9 5M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3" />),
  note: icon(
    <>
      <path d="M5.5 4.5h13v15h-13Z" />
      <path d="M12 9v6M9 12h6" />
    </>,
  ),
  shield: icon(<path d="M12 3.5 5 6.5v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9v-5Z" />),
  bolt: icon(<path d="M13 3.5 5 13.5h5.5L11 20.5l8-11h-5.5Z" />),
  pulse: icon(<path d="M3.5 12h4l2.5-6 4 12 2.5-6h4" />),
  headset: icon(
    <>
      <path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" />
      <rect x="3.5" y="13.5" width="4" height="6" rx="1.5" />
      <rect x="16.5" y="13.5" width="4" height="6" rx="1.5" />
    </>,
  ),
  alert: icon(
    <>
      <path d="M10.3 4.6 3 18a2 2 0 0 0 1.7 3h14.6A2 2 0 0 0 21 18L13.7 4.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>,
  ),
  clock: icon(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>,
  ),
  home: icon(<path d="M4 11.5 12 4l8 7.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1Z" />),
  team: icon(
    <>
      <g className="im-bob">
        <circle cx="9" cy="8.5" r="3" />
        <path d="M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5" />
      </g>
      <g className="im-bob">
        <circle cx="16.5" cy="9.5" r="2.3" />
        <path d="M15.5 14.2c2.4-.3 4.4 1.3 5 4.8" />
      </g>
    </>,
  ),
  userPlus: icon(
    <>
      <circle cx="10" cy="9" r="3.5" />
      <path d="M3.5 19.5c.8-3 3.3-5 6.5-5 1.6 0 3 .5 4.1 1.3M18 14v6M15 17h6" />
    </>,
  ),
} satisfies Record<string, Icon>;
