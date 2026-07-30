import { cn } from "@/lib/utils";

// Brand mark — a rounded leaf in the lime brand color (DESIGN.md primary).
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("size-8", className)}
      aria-hidden
    >
      <path
        d="M27 5C16 5 6 9 6 20c0 3 1 5 2 7 1-9 7-14 15-16-6 4-10 8-11 16 8 1 15-4 15-14V5Z"
        fill="var(--primary)"
      />
      <path
        d="M27 5C16 5 6 9 6 20c0 3 1 5 2 7"
        stroke="var(--ink-deep)"
        strokeWidth="0.5"
        opacity="0.15"
      />
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {showWordmark && (
        <span className="font-display text-lg font-extrabold tracking-tight text-ink">
          English Dreams
        </span>
      )}
    </span>
  );
}
