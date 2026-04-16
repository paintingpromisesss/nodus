import { AlertCircle, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getDomainFromUrl } from "@/lib/media";

interface ErrorCardProps {
  url: string;
  message: string;
}

export function ErrorCard({ url, message }: ErrorCardProps) {
  return (
    <Card className="nodus-surface overflow-hidden border-destructive/35 bg-[linear-gradient(180deg,rgba(63,24,24,0.78),rgba(24,12,12,0.9))] animate-fade-up">
      <div className="grid gap-6 p-5 lg:grid-cols-[15rem,minmax(0,1fr)] lg:p-6">
        <div className="rounded-[1.35rem] border border-destructive/25 bg-black/20 p-4">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-destructive-foreground/70">Failed source</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-destructive-foreground/85">
            <Link2 className="size-4" />
            <span className="truncate">{getDomainFromUrl(url)}</span>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">{url}</p>
        </div>

        <div className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-2">
              <p className="section-kicker">Stream issue</p>
              <h3 className="font-display text-3xl leading-none tracking-[-0.04em] text-foreground md:text-4xl">
                Could not fetch metadata
              </h3>
            </div>

            <Badge variant="destructive" className="gap-2">
              <AlertCircle className="size-3.5" />
              Error
            </Badge>
          </div>

          <p className="max-w-3xl text-sm leading-7 text-destructive-foreground/90">{message}</p>

          <div className="rounded-[1.2rem] border border-destructive/20 bg-black/20 px-4 py-3 text-sm leading-6 text-muted-foreground">
            This slot stays in place so the queue remains readable. You can retry the batch, replace the source, or leave
            the failed card as a marker while the rest completes.
          </div>
        </div>
      </div>
    </Card>
  );
}
