import Image from "next/image";
import { cn } from "@/lib/utils";

// Brand mark — renders the custom mini icon logo.
export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative shrink-0 select-none", className || "size-14")}>
      <Image
        src="/main-logo.png"
        alt="English Dreams Icon"
        fill
        sizes="44px"
        className="object-contain"
        priority
      />
    </div>
  );
}

// Full logo — renders the main brand logo containing both mark and text.
export function Logo({
  className,
  priority = true,
  centered = false,
}: {
  className?: string;
  priority?: boolean;
  centered?: boolean;
}) {
  return (
    <div className={cn("relative h-14 w-40 shrink-0 select-none", className)}>
      <Image
        src="/main-logo.png"
        alt="English Dreams"
        fill
        sizes="160px"
        className={cn("object-contain", centered ? "object-center" : "object-left")}
        priority={priority}
      />
    </div>
  );
}
