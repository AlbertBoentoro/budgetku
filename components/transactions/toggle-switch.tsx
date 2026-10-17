"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

import { cn } from "@/lib/utils";

// A Stitch-style switch built on the Radix Checkbox primitive (no new
// dependency): it keeps the exact checkbox semantics and the same
// checked/onCheckedChange API the form already binds to its recurring state.
// The 44px-tall track keeps the tap target accessible; the thumb slides on
// data-[state=checked].
const ToggleSwitch = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "group relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-surface-container-high px-0.5 shadow-inner transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
      className,
    )}
    {...props}
  >
    <span
      aria-hidden
      className="pointer-events-none block size-6 translate-x-0 rounded-full bg-surface-container-lowest shadow-sm transition-transform group-data-[state=checked]:translate-x-5"
    />
  </CheckboxPrimitive.Root>
));
ToggleSwitch.displayName = "ToggleSwitch";

export { ToggleSwitch };
