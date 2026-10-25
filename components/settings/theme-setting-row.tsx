"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface ThemeOption {
  value: "light" | "dark" | "system";
  label: string;
  glyph: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "Terang", glyph: "light_mode" },
  { value: "dark", label: "Gelap", glyph: "dark_mode" },
  { value: "system", label: "Sistem", glyph: "desktop_windows" },
];

/**
 * Stitch theme selector row for the Settings screen.
 * Provides accessible, tap-friendly (44px) segmented controls to switch between
 * light, dark, and system themes via next-themes.
 */
export function ThemeSettingRow() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name="palette" size={22} />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-body-md font-medium text-on-surface">Tema</span>
          <span className="text-body-sm text-on-surface-variant">
            Pilih mode terang, gelap, atau sistem.
          </span>
        </div>
      </div>

      <div
        role="group"
        aria-label="Pilihan tema"
        className="grid grid-cols-3 gap-1 rounded-xl bg-surface-container-low p-1 sm:w-auto"
      >
        {THEME_OPTIONS.map((opt) => {
          const selected = mounted && theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-surface-container-lowest text-primary shadow-sm font-semibold"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              <Icon name={opt.glyph} size={18} />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </li>
  );
}
