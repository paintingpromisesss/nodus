import { LoaderCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PendingCardProps {
  url: string;
  className?: string;
  staticPreview?: boolean;
}

export function PendingCard({ url: _url, className, staticPreview = false }: PendingCardProps) {
  const skeletonClassName = staticPreview
    ? "rounded-[1rem] bg-white/[0.08]"
    : "animate-shimmer rounded-[1rem] bg-[linear-gradient(110deg,rgba(255,255,255,0.05),rgba(255,255,255,0.12),rgba(255,255,255,0.05))] bg-[length:200%_100%]";

  return (
    <Card className={cn("nodus-surface overflow-hidden animate-fade-up", className)}>
      <div className="grid gap-6 p-5 lg:grid-cols-[15rem,minmax(0,1fr)] lg:p-6">
        <div className="relative lg:self-start">
          <Skeleton className={cn("aspect-[1.16] w-full rounded-[1.35rem]", skeletonClassName)} />
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid min-w-0 gap-3">
              <Skeleton className={cn("h-12 w-full max-w-[38rem] rounded-[0.95rem]", skeletonClassName)} />

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Skeleton className={cn("h-4 w-14 rounded-full", skeletonClassName)} />
                <span className="nodus-dot opacity-40" />
                <Skeleton className={cn("h-4 w-12 rounded-full", skeletonClassName)} />
              </div>

              <Skeleton className={cn("h-7 w-36 rounded-full", skeletonClassName)} />
            </div>

            <div className="flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-black/20 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <LoaderCircle className={cn("size-3.5 text-[color:var(--accent)]", !staticPreview && "animate-spin")} />
              Reading link
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-white/[0.05]" />

      <div className="grid gap-3 p-5 lg:grid-cols-[3.25rem,15rem,minmax(0,1fr),auto] lg:items-center lg:p-6">
        <Skeleton className={cn("h-12 w-[3.25rem] rounded-[1rem]", skeletonClassName)} />
        <Skeleton className={cn("h-12 w-full rounded-[1rem]", skeletonClassName)} />

        <div className="hidden justify-end lg:flex">
          <Skeleton className={cn("h-10 w-full max-w-[24rem] rounded-full", skeletonClassName)} />
        </div>

        <Skeleton className={cn("h-12 w-full rounded-[1rem] lg:w-[11rem]", skeletonClassName)} />
      </div>
    </Card>
  );
}
