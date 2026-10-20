import type { SVGProps } from "react";
import { Icons } from "@/components/icons";
import type { ItemType } from "@/components/inventory/item-meta";

/** A price tag on the shared 24px / 1.5-stroke grid, for items that aren't counted. */
function TagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3.5 12.1V4.5a1 1 0 0 1 1-1h7.6a1 1 0 0 1 .7.3l7.7 7.7a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0l-7.7-7.7a1 1 0 0 1-.3-.7Z" />
      <circle cx="8.25" cy="8.25" r="1.25" />
    </svg>
  );
}

export function ItemTypeIcon({ type, className }: { type: ItemType; className?: string }) {
  if (type === "inventory") return <Icons.inventory className={className} />;
  if (type === "service") return <Icons.clock className={className} />;
  return <TagIcon className={className} />;
}
