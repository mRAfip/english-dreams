import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Button — shadcn-style primitive, styled from design tokens (DESIGN.md).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // button-primary: solid brand pill — reserve for the single lead action
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-active",
        // button-soft: tonal brand — pale fill, deep-blue label. Lower contrast
        // than primary, so several can sit in a list without competing.
        soft: "bg-primary-pale text-ink-deep hover:bg-primary-pale/70",
        // button-secondary: cool fill
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // button-tertiary: white with ink outline
        tertiary:
          "border border-ink bg-card text-ink hover:bg-secondary/50",
        outline:
          "border border-border bg-card text-foreground hover:bg-secondary/50",
        ghost: "text-foreground hover:bg-secondary/60",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-brand-green underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-3",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
