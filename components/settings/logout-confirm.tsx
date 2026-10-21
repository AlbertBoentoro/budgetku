"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LogoutButton } from "@/components/logout-button";

// Keluar with an inline confirmation step. Expands in place instead of a
// dialog (no dialog primitive in the project); the actual sign-out is the
// shared LogoutButton, unchanged.
export function LogoutConfirm() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const textId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Move focus into the panel when it opens so keyboard users land on Batal.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Red TEXT uses the darker red-700 text token (text-expense, AA on white and
  // on the hover surface); the bright #DC2626 (destructive) is kept for the
  // filled "Ya, keluar" button only, per DESIGN.md D3.
  return (
    <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left text-expense transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container">
          <Icon name="logout" size={22} />
        </span>
        <span className="text-body-md font-medium">Keluar</span>
      </button>

      {/* Always in the DOM (hidden when closed) so aria-controls stays valid.
          The display utilities live on the inner div so they cannot override
          the hidden attribute. */}
      <div
        id={panelId}
        hidden={!open}
        role="group"
        aria-labelledby={textId}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            close();
          }
        }}
        className="border-t border-outline-variant"
      >
        <div className="flex flex-col gap-3 px-4 py-4">
          <p id={textId} className="text-body-sm text-on-surface-variant">
            Keluar dari Budgetku? Kamu perlu masuk lagi untuk melihat data
            keuanganmu.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              ref={cancelRef}
              type="button"
              variant="outline"
              onClick={close}
              className="h-11 min-w-[8rem] flex-1"
            >
              Batal
            </Button>
            <LogoutButton
              type="button"
              variant="destructive"
              className="h-11 min-w-[8rem] flex-1"
            >
              Ya, keluar
            </LogoutButton>
          </div>
        </div>
      </div>
    </div>
  );
}
