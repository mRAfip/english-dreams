"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// shadcn-style switch. Self-contained (no Radix dependency): an accessible
// button with role="switch" and a sliding thumb. Controlled via `checked` /
// `onCheckedChange`. Styled purely with design tokens.

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled, className, ...props }, ref) => {
    const state = checked ? "checked" : "unchecked";
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={state}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-border",
          className,
        )}
        {...props}
      >
        <span
          data-state={state}
          className={cn(
            "pointer-events-none block size-5 rounded-full bg-card shadow-sm ring-0 transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
