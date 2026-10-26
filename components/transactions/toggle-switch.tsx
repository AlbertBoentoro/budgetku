"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

import { cn } from "@/lib/utils";

// A Stitch-style switch built on the Radix Checkbox primitive (no new
// dependency): it keeps the exact checkbox semantics and the same
// checked/onCheckedChange API the form already binds to its recurring state.
// Keep the hit area 44px tall while leaving the visual track compact.
const ToggleSwitch = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "group relative inline-flex h-11 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <span
      aria-hidden
      className="pointer-events-none flex h-7 w-12 items-center rounded-full border border-transparent bg-surface-container-high px-0.5 shadow-inner transition-colors group-data-[state=checked]:bg-primary"
    >
      <span className="block size-6 translate-x-0 rounded-full bg-surface-container-lowest shadow-sm transition-transform group-data-[state=checked]:translate-x-5" />
    </span>
  </CheckboxPrimitive.Root>
));
ToggleSwitch.displayName = "ToggleSwitch";

export { ToggleSwitch };
