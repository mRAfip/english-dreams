import * as React from "react";
import { cn } from "@/lib/utils";

// Textarea — the multi-line counterpart to Input. Same border, radius and focus
// ring, so a form that mixes the two reads as one control set.
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-md border border-input bg-card px-4 py-3 text-sm text-foreground shadow-sm transition-colors",
        "placeholder:text-mute focus-visible:outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-primary/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
