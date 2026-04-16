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
      <div className="grid gap-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-2">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Link2 className="size-4" />
              <span className="truncate">{getDomainFromUrl(url)}</span>
            </div>

            <h3 className="font-display text-3xl leading-none tracking-[-0.03em] text-foreground">
              Could not fetch metadata
            </h3>
          </div>

          <Badge variant="destructive" className="gap-2">
            <AlertCircle className="size-3.5" />
            Error
          </Badge>
        </div>

        <p className="max-w-3xl text-sm leading-6 text-destructive-foreground/90">{message}</p>
        <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">{url}</p>
      </div>
    </Card>
  );
}
