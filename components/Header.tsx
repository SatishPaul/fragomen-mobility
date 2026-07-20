import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-edge/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src={brand.logo} alt={brand.name} width={150} height={40} priority />
        </Link>
        <Link
          href="/create"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:brightness-110"
        >
          Create video
        </Link>
      </div>
    </header>
  );
}
