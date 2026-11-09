"use client";

import { useRef, useState, useTransition, type TouchEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { Icon } from "@/components/ui/icon";
import {
  getPullRefreshDistance,
  isPullRefreshReady,
} from "@/lib/pull-refresh";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, startRefresh] = useTransition();
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const distanceRef = useRef(0);

  function resetGesture() {
    startPoint.current = null;
    distanceRef.current = 0;
    setPullDistance(0);
  }

  function atTop() {
    return Math.max(window.scrollY, document.scrollingElement?.scrollTop ?? 0) <= 1;
  }

  function onPullStart(event: TouchEvent<HTMLDivElement>) {
    resetGesture();
    if (isRefreshing || event.touches.length !== 1 || !atTop()) return;
    const element = event.target;
    // Form fields, buttons, menus and dialogs keep their native gestures.
    if (
      element instanceof Element &&
      element.closest(
        "input, textarea, select, button, [role='dialog'], [role='menu'], [contenteditable='true'], [data-pull-refresh-exclude]",
      )
    ) return;
    const touch = event.touches[0];
    startPoint.current = { x: touch.clientX, y: touch.clientY };
  }

  function onPullMove(event: TouchEvent<HTMLDivElement>) {
    if (!startPoint.current || event.touches.length !== 1 || isRefreshing) return;
    const touch = event.touches[0];
    const distance = getPullRefreshDistance(
      startPoint.current.x,
      startPoint.current.y,
      touch.clientX,
      touch.clientY,
      Math.max(window.scrollY, document.scrollingElement?.scrollTop ?? 0),
    );
    distanceRef.current = distance;
    setPullDistance(distance);
  }

  function onPullEnd() {
    const shouldRefresh = !isRefreshing &&
      atTop() && isPullRefreshReady(distanceRef.current);
    resetGesture();
    if (shouldRefresh) {
      // Re-fetch server-rendered data without reloading the document or
      // wiping local form state, theme, or the user's current route.
      startRefresh(() => router.refresh());
    }
  }
  const isHomePage = pathname === "/dashboard";
  const isPrimaryNavigationPage = [
    "/dashboard",
    "/transactions",
    "/budget",
    "/accounts",
  ].includes(pathname);

  return (
    <div
      className="relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col"
      onTouchStart={onPullStart}
      onTouchMove={onPullMove}
      onTouchEnd={onPullEnd}
      onTouchCancel={resetGesture}
    >
      {(pullDistance > 8 || isRefreshing) ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-[calc(3.75rem+env(safe-area-inset-top))] z-50 flex justify-center px-4"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-2 text-label-md text-on-surface shadow-soft">
            <Icon
              name="sync"
              size={18}
              className={isRefreshing ? "animate-spin text-primary" : "text-on-surface-variant"}
            />
            {isRefreshing
              ? "Memuat ulang data…"
              : isPullRefreshReady(pullDistance)
                ? "Lepas untuk refresh"
                : "Tarik untuk refresh"}
          </span>
        </div>
      ) : null}
      {isHomePage ? (
        <header className="fixed inset-x-0 top-0 z-40 mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 bg-surface/80 px-4 pt-safe backdrop-blur-xl">
          <Link
            href="/dashboard"
            className="flex min-h-11 items-center gap-2 text-title-md font-semibold text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <Image
              src="/icons/budgetku-ledger.svg"
              alt=""
              width={28}
              height={28}
              loading="eager"
            />
            Budgetku
          </Link>
          <Link
            href="/settings"
            className="flex size-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <Icon name="settings" size={22} aria-label="Pengaturan" />
          </Link>
        </header>
      ) : null}

      <main
        className={
          isHomePage
            ? "flex-1 pt-[calc(3.5rem+env(safe-area-inset-top))]"
            : "flex-1 pt-[calc(0.5rem+env(safe-area-inset-top))]"
        }
      >
        {children}
      </main>

      {isPrimaryNavigationPage ? <BottomNav /> : null}
    </div>
  );
}
