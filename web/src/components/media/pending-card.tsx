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
      <div className="grid gap-5 p-5 lg:grid-cols-[13.75rem,minmax(0,1fr)]">
        <Skeleton className="aspect-video w-full rounded-[1.2rem]" />

        <div className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid min-w-0 gap-3">
              <Skeleton className="h-12 w-full max-w-[30rem]" />
              <p className="truncate text-sm text-muted-foreground">{getDomainFromUrl(url)}</p>
            </div>

            <Badge variant="outline" className="gap-2 px-3 py-1.5">
              <LoaderCircle className="size-3.5 animate-spin" />
              Fetching
            </Badge>
          </div>

          <div className="grid gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
    </Card>
  );
}
