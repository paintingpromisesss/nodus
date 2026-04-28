import * as React from "react";
import { ErrorCard } from "@/components/media/error-card";
import { MediaCard } from "@/components/media/media-card";
import { PendingCard } from "@/components/media/pending-card";
import type { Language } from "@/lib/i18n";
import type { ExpandedConfig, MediaCard as MediaCardRecord, QuickQualityMode, SuccessMediaCard } from "@/lib/media";

interface MediaCardSlotProps {
  card: MediaCardRecord;
  onCompactChoiceChange: (index: number, compactChoiceId: string) => void;
  onQuickQualityModeChange: (index: number, quickQualityMode: QuickQualityMode) => void;
  onConfigChange: (index: number, updater: (current: ExpandedConfig) => ExpandedConfig) => void;
  onCompactDownload: (index: number) => void | Promise<void>;
  onExpandedDownload: (index: number) => void | Promise<void>;
  language: Language;
}

type SlotPhase = "steady" | "exiting-pending";

export function MediaCardSlot({
  card,
  onCompactChoiceChange,
  onQuickQualityModeChange,
  onConfigChange,
  onCompactDownload,
  onExpandedDownload,
  language,
}: MediaCardSlotProps) {
  const [phase, setPhase] = React.useState<SlotPhase>("steady");
  const [displayCard, setDisplayCard] = React.useState<MediaCardRecord>(card);
  const [enteringSuccess, setEnteringSuccess] = React.useState(false);
  const previousCardRef = React.useRef(card);

  React.useEffect(() => {
    const previousCard = previousCardRef.current;
    previousCardRef.current = card;

    if (previousCard.state === "pending" && card.state === "success") {
      setPhase("exiting-pending");
      setEnteringSuccess(false);

      const timeout = window.setTimeout(() => {
        setDisplayCard(card);
        setPhase("steady");
        setEnteringSuccess(true);
      }, 170);

      return () => {
        window.clearTimeout(timeout);
      };
    }

    setDisplayCard(card);
    setPhase("steady");
    setEnteringSuccess(false);
    return undefined;
  }, [card]);

  React.useEffect(() => {
    if (!enteringSuccess) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setEnteringSuccess(false);
    }, 180);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [enteringSuccess]);

  if (phase === "exiting-pending" && displayCard.state === "pending") {
    return <PendingCard url={displayCard.url} className="animate-resolve-overlay-out" language={language} />;
  }

  if (displayCard.state === "pending") {
    return <PendingCard url={displayCard.url} language={language} />;
  }

  if (displayCard.state === "error") {
    return <ErrorCard url={displayCard.url} message={displayCard.message} language={language} />;
  }

  const successCard = displayCard as SuccessMediaCard;

  return (
    <MediaCard
      className={enteringSuccess ? "animate-resolve-content-in" : undefined}
      card={successCard}
      onCompactChoiceChange={(value) => onCompactChoiceChange(successCard.index, value)}
      onQuickQualityModeChange={(value) => onQuickQualityModeChange(successCard.index, value)}
      onConfigChange={(updater) => onConfigChange(successCard.index, updater)}
      onCompactDownload={() => void onCompactDownload(successCard.index)}
      onExpandedDownload={() => void onExpandedDownload(successCard.index)}
      language={language}
    />
  );
}
