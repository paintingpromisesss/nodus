import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ToggleGroupContext = React.createContext<
  VariantProps<typeof buttonVariants>
>({
  size: "sm",
  variant: "secondary",
});

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof buttonVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn("inline-flex items-center justify-center gap-2", className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof buttonVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        buttonVariants({
          variant: context.variant || variant || "secondary",
          size: context.size || size || "sm",
        }),
        "min-w-[7rem] border border-[color:var(--line)] bg-transparent text-muted-foreground data-[state=on]:border-[color:var(--line-strong)] data-[state=on]:bg-primary/15 data-[state=on]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
});
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
