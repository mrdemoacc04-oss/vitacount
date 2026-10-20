import { Icons, type Icon } from "@/components/icons";

/**
 * The app's map, shared by the sidebar, the command menu (⌘K) and the New menu
 * so a destination is named and drawn the same way everywhere.
 */

export type NavItem = {
  label: string;
  href: string;
  icon: Icon;
  /** extra words the command menu should match on */
  keywords?: string;
};

export type NavGroup = { label: string | null; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Icons.dashboard, keywords: "home overview kpi" },
      { label: "Transactions", href: "/transactions", icon: Icons.transactions, keywords: "feed activity" },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Sales", href: "/sales", icon: Icons.sales, keywords: "invoices receivables ar income money in" },
      { label: "Expenses", href: "/expenses", icon: Icons.expenses, keywords: "bills payables ap money out" },
      { label: "Banking", href: "/banking", icon: Icons.banking, keywords: "accounts cash" },
      { label: "Reconciliation", href: "/reconciliation", icon: Icons.reconciliation, keywords: "match statements" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Contacts", href: "/contacts", icon: Icons.contacts, keywords: "customers suppliers vendors" },
      { label: "Projects", href: "/projects", icon: Icons.projects, keywords: "profitability jobs" },
      { label: "Inventory", href: "/inventory", icon: Icons.inventory, keywords: "stock fifo items" },
      { label: "Documents", href: "/documents", icon: Icons.documents, keywords: "receipts ocr uploads" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", href: "/reports", icon: Icons.reports, keywords: "p&l balance sheet analytics" },
      { label: "Agents", href: "/agents", icon: Icons.agents, keywords: "ai automation audit log control plane" },
    ],
  },
  {
    label: "Ledger",
    items: [
      { label: "Journal entries", href: "/cpa/journal-entries", icon: Icons.ledger, keywords: "cpa debits credits gl" },
      { label: "Chart of accounts", href: "/cpa/accounts", icon: Icons.accounts, keywords: "cpa coa" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Team", href: "/team", icon: Icons.team, keywords: "members invite roles users people" },
      { label: "Settings", href: "/settings", icon: Icons.settings, keywords: "company profile invoicing tax security password" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === "/settings")!;

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** The nav item whose section the pathname is in — the longest matching prefix wins. */
export function activeNavHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of ALL_NAV_ITEMS) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}

export type CreateAction = { label: string; description: string; href: string; icon: Icon };
export type CreateSection = { title: string; viewAll: { label: string; href: string }; items: CreateAction[] };

// Customers and suppliers mirror each other: bill later / paid now / money moves / adjustments.
export const CREATE_SECTIONS: CreateSection[] = [
  {
    title: "Customers",
    viewAll: { label: "All sales", href: "/sales" },
    items: [
      { label: "Invoice", description: "Bill a customer, get paid later", href: "/sales/new?type=invoice", icon: Icons.invoice },
      { label: "Sales receipt", description: "A sale paid on the spot", href: "/sales/new?type=sales_receipt", icon: Icons.receipt },
      { label: "Payment received", description: "Money in, split across invoices", href: "/sales/receive-payment", icon: Icons.coinIn },
      { label: "Refund", description: "Give money back to a customer", href: "/sales/new?type=refund_receipt", icon: Icons.refund },
      { label: "Debit note", description: "Add a charge to what they owe", href: "/sales/new?type=debit_note", icon: Icons.note },
    ],
  },
  {
    title: "Suppliers",
    viewAll: { label: "All expenses", href: "/expenses" },
    items: [
      { label: "Bill", description: "A supplier invoice to pay later", href: "/expenses/new?type=bill", icon: Icons.invoice },
      { label: "Expense", description: "Something already paid for", href: "/expenses/new?type=expense", icon: Icons.receipt },
      { label: "Payment made", description: "Pay one or more bills at once", href: "/expenses/pay-bills", icon: Icons.coinOut },
      { label: "Supplier credit", description: "A credit note from a supplier", href: "/expenses/new?type=vendor_credit", icon: Icons.refund },
    ],
  },
];
