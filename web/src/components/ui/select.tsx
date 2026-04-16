import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectRootProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>;

const SelectContext = React.createContext<{
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
} | null>(null);

const Select = ({ open: openProp, defaultOpen, onOpenChange, ...props }: SelectRootProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const setOpen = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (nextValue) => {
      const resolved = typeof nextValue === "function" ? nextValue(open) : nextValue;
      if (!isControlled) {
        setUncontrolledOpen(resolved);
      }
      onOpenChange?.(resolved);
    },
    [isControlled, onOpenChange, open],
  );

  return (
    <SelectContext.Provider value={{ open, setOpen }}>
      <SelectPrimitive.Root
        open={open}
        onOpenChange={setOpen}
        {...props}
      />
    </SelectContext.Provider>
  );
};

const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, onPointerDown, onClick, ...props }, ref) => {
  const selectContext = React.useContext(SelectContext);
  const lastPointerTypeRef = React.useRef<string | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(event);
    lastPointerTypeRef.current = event.pointerType;

    if (event.defaultPrevented || !selectContext?.open) {
      return;
    }

    if (event.pointerType === "touch" || event.pointerType === "pen") {
      event.preventDefault();
      event.stopPropagation();
      selectContext.setOpen(false);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !selectContext?.open) {
      return;
    }

    const pointerType = lastPointerTypeRef.current;
    if (pointerType === "touch" || pointerType === "pen") {
      event.preventDefault();
      event.stopPropagation();
      selectContext.setOpen(false);
    }
  };

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-11 w-full items-center justify-between rounded-[0.95rem] border border-[color:var(--line)] bg-white/[0.03] px-4 py-2 text-sm text-foreground transition-[background-color,border-color,color,box-shadow] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className,
      )}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => {
  const [viewportNode, setViewportNode] = React.useState<HTMLDivElement | null>(null);
  const [thumb, setThumb] = React.useState({ visible: false, height: 0, offset: 0 });
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<{
    pointerId: number;
    startY: number;
    startOffset: number;
    trackHeight: number;
    thumbHeight: number;
  } | null>(null);

  React.useLayoutEffect(() => {
    const viewport = viewportNode;
    if (!viewport) {
      return;
    }

    const updateThumb = () => {
      const { clientHeight, scrollHeight, scrollTop } = viewport;
      if (scrollHeight <= clientHeight + 1) {
        setThumb({ visible: false, height: 0, offset: 0 });
        return;
      }

      const trackHeight = clientHeight - 16;
      const nextHeight = Math.max((clientHeight / scrollHeight) * trackHeight, 40);
      const maxOffset = Math.max(trackHeight - nextHeight, 0);
      const nextOffset = (scrollTop / (scrollHeight - clientHeight)) * maxOffset;

      setThumb({
        visible: true,
        height: nextHeight,
        offset: Number.isFinite(nextOffset) ? nextOffset : 0,
      });
    };

    updateThumb();

    viewport.addEventListener("scroll", updateThumb, { passive: true });
    const resizeObserver = new ResizeObserver(updateThumb);
    resizeObserver.observe(viewport);

    const raf1 = requestAnimationFrame(updateThumb);
    const raf2 = requestAnimationFrame(updateThumb);
    const raf3 = requestAnimationFrame(() => requestAnimationFrame(updateThumb));

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelAnimationFrame(raf3);
      viewport.removeEventListener("scroll", updateThumb);
      resizeObserver.disconnect();
    };
  }, [viewportNode, children]);

  const syncViewportScroll = React.useCallback(
    (nextOffset: number, trackHeight: number, thumbHeight: number) => {
      const viewport = viewportNode;
      if (!viewport) {
        return;
      }

      const maxOffset = Math.max(trackHeight - thumbHeight, 0);
      const clampedOffset = Math.min(Math.max(nextOffset, 0), maxOffset);
      const maxScroll = Math.max(viewport.scrollHeight - viewport.clientHeight, 0);
      const ratio = maxOffset > 0 ? clampedOffset / maxOffset : 0;
      viewport.scrollTop = ratio * maxScroll;
    },
    [viewportNode],
  );

  const endThumbDrag = React.useCallback(() => {
    dragStateRef.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  React.useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const deltaY = event.clientY - dragState.startY;
      syncViewportScroll(dragState.startOffset + deltaY, dragState.trackHeight, dragState.thumbHeight);
    };

    const handlePointerUp = () => {
      endThumbDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [endThumbDrag, syncViewportScroll]);

  const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!thumb.visible || !trackRef.current) {
      return;
    }

    const trackRect = trackRef.current.getBoundingClientRect();
    const clickY = event.clientY - trackRect.top;
    const nextOffset = clickY - thumb.height / 2;
    syncViewportScroll(nextOffset, trackRect.height, thumb.height);
  };

  const handleThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!thumb.visible || !trackRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const trackRect = trackRef.current.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset: thumb.offset,
      trackHeight: trackRect.height,
      thumbHeight: thumb.height,
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  };

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-[1.1rem] border border-[color:var(--line)] bg-[rgba(20,20,20,0.98)] text-foreground shadow-nodus",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.Viewport
          ref={setViewportNode}
          className={cn(
            "animate-fade-up max-h-96 overflow-y-auto overflow-x-hidden p-1.5 pr-5",
            position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>

        {thumb.visible ? (
          <div
            ref={trackRef}
            className="absolute bottom-2 right-1 top-2 w-2.5 cursor-pointer rounded-full bg-white/[0.08]"
            onPointerDown={handleTrackPointerDown}
          >
            <div
              className="absolute left-0 right-0 cursor-grab rounded-full bg-[linear-gradient(180deg,rgba(198,170,126,0.78),rgba(161,132,92,0.82))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_0_0_1px_rgba(0,0,0,0.1)]"
              onPointerDown={handleThumbPointerDown}
              style={{
                height: `${thumb.height}px`,
                transform: `translateY(${thumb.offset}px)`,
              }}
            />
          </div>
        ) : null}
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label ref={ref} className={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground", className)} {...props} />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-[0.85rem] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:bg-white/[0.06] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-3 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-white/[0.06]", className)} {...props} />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
