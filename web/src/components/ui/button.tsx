import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[1.1rem] text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(213,176,122,0.18)] hover:bg-[hsl(35_52%_70%)] hover:shadow-[0_14px_34px_rgba(213,176,122,0.24)]",
        secondary:
          "border border-[color:var(--line)] bg-white/5 text-foreground hover:border-[color:var(--line-strong)] hover:bg-white/8",
        ghost: "text-foreground hover:bg-white/6",
        outline:
          "border border-[color:var(--line)] bg-transparent text-foreground hover:border-[color:var(--line-strong)] hover:bg-white/5",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-[0.95rem] px-4 text-[0.8125rem]",
        lg: "h-12 rounded-[1.2rem] px-6 text-base",
        icon: "size-11 rounded-[0.95rem]",
      },
    },
    defaultVariants: {
      variant: "default",
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
