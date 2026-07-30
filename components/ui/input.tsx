import * as React from "react";
import { cn } from "@/lib/utils";

// Input — shadcn-style text field. text-input token: rounded-md, ink border.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-md border border-input bg-card px-4 py-2 text-sm text-foreground shadow-sm transition-colors",
          "placeholder:text-mute focus-visible:outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-primary/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
