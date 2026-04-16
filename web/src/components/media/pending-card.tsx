import { LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDomainFromUrl } from "@/lib/media";

interface PendingCardProps {
  url: string;
}

export function PendingCard({ url }: PendingCardProps) {
  return (
    <Card className="nodus-surface overflow-hidden animate-fade-up">
      <div className="grid gap-6 p-5 lg:grid-cols-[15rem,minmax(0,1fr)] lg:p-6">
        <div className="relative">
          <Skeleton className="aspect-[1.16] w-full rounded-[1.35rem]" />
          <div className="absolute inset-x-3 bottom-3 rounded-[1.1rem] border border-white/8 bg-[rgba(14,12,11,0.72)] px-3 py-2 backdrop-blur">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-[color:var(--accent-2)]">Source</p>
            <p className="mt-1 truncate text-sm text-foreground">{getDomainFromUrl(url)}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid min-w-0 gap-3">
              <p className="section-kicker">Resolving media card</p>
              <Skeleton className="h-12 w-full max-w-[30rem]" />
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Waiting for metadata</span>
                <span className="nodus-dot" />
                <span>Slot reserved</span>
              </div>
            </div>

            <Badge variant="outline" className="gap-2 px-3 py-1.5">
              <LoaderCircle className="size-3.5 animate-spin" />
              Fetching
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Skeleton className="h-20 rounded-[1.25rem]" />
            <Skeleton className="h-20 rounded-[1.25rem]" />
            <Skeleton className="h-20 rounded-[1.25rem]" />
          </div>
        </div>
      </div>
    </Card>
  );
}
