import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-[0.75rem] font-medium tracking-[0.08em] uppercase transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/90 text-primary-foreground",
        secondary: "border-[color:var(--line)] bg-white/[0.05] text-foreground",
        outline: "border-[color:var(--line)] bg-transparent text-muted-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
