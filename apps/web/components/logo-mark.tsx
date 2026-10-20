import Image from "next/image";

/** The VitaCount mark: the isometric blue wallet (source: design/logo/vitacount-wallet-mark-1024.png). */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <Image
      src="/brand/vitacount-mark.png"
      alt=""
      aria-hidden="true"
      width={64}
      height={64}
      priority
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
