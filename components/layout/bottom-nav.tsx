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

// Mockup order: Beranda, Transaksi, Anggaran, Laporan, Rekening.
// Pengaturan leaves the bottom nav — it is reachable via the shell header
// settings icon (see app/(app)/layout.tsx).
const items: NavItem[] = [
  { href: "/dashboard", label: "Beranda", icon: "home" },
  { href: "/transactions", label: "Transaksi", icon: "swap_horiz" },
  { href: "/budget", label: "Anggaran", icon: "pie_chart" },
  { href: "/reports", label: "Laporan", icon: "bar_chart" },
  { href: "/accounts", label: "Rekening", icon: "account_balance_wallet" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface/90 pb-safe backdrop-blur-xl">
      <ul className="mx-auto flex w-full max-w-md items-stretch justify-between px-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-2 text-label-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  active ? "text-primary" : "text-on-surface-variant",
                )}
              >
                <Icon name={item.icon} size={24} fill={active} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
