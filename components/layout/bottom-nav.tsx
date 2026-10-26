"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

// Five slots with a raised center "Catat" (+) action:
// Beranda, Transaksi, [Catat], Anggaran, Rekening. Laporan is linked from
// Pengaturan. Pengaturan stays in the shell header.
const leftItems: NavItem[] = [
  { href: "/dashboard", label: "Beranda", icon: "home" },
  { href: "/transactions", label: "Transaksi", icon: "receipt_long" },
];

const rightItems: NavItem[] = [
  { href: "/budget", label: "Anggaran", icon: "pie_chart" },
  { href: "/accounts", label: "Rekening", icon: "credit_card" },
];

const CENTER_HREF = "/transactions/new";

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);

    return (
      <li key={item.href} className="flex-1">
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-[44px] flex-col items-center gap-1 rounded-lg py-2 text-label-xs transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
            active ? "text-primary font-semibold" : "text-on-surface-variant",
          )}
        >
          <Icon name={item.icon} size={24} fill={active} />
          <span className="max-[360px]:text-[10px] max-[240px]:sr-only">
            {item.label}
          </span>
        </Link>
      </li>
    );
  };

  const centerActive = isActive(CENTER_HREF);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface/90 pb-safe backdrop-blur-xl">
      <ul className="mx-auto flex w-full max-w-md items-end justify-between px-2">
        {leftItems.map(renderItem)}

        <li className="flex-1">
          <Link
            href={CENTER_HREF}
            aria-current={centerActive ? "page" : undefined}
            aria-label="Catat transaksi"
            className={cn(
              "-mt-5 flex flex-col items-center gap-1 rounded-lg pb-2 pt-1 text-label-xs transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              centerActive ? "text-primary font-semibold" : "text-on-surface-variant",
            )}
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft">
              <Icon name="add" size={28} />
            </span>
            <span className="max-[360px]:text-[10px] max-[240px]:sr-only">
              Catat
            </span>
          </Link>
        </li>

        {rightItems.map(renderItem)}
      </ul>
    </nav>
  );
}
