import { ChevronDown, ChevronUp, Download, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  buildAudioFormatLabel,
  buildVideoFormatLabel,
  coerceExpandedConfig,
  describeCompactSelection,
  describeSelection,
  formatBytes,
  formatDuration,
  getApproxSize,
  getAudioCodecOptions,
  getAudioOnlyFormats,
  getCompactChoices,
  getCompatibleContainers,
  getDomainFromUrl,
  getMediaBadgeLabel,
  getPlatformLabel,
  getVideoCodecOptions,
  getVideoFormats,
  hasAudio,
  type ExpandedConfig,
  type ExpandedMode,
  type SuccessMediaCard,
} from "@/lib/media";

interface MediaCardProps {
  card: SuccessMediaCard;
  onCompactChoiceChange: (compactChoiceId: string) => void;
  onConfigChange: (updater: (current: ExpandedConfig) => ExpandedConfig) => void;
  onCompactDownload: () => void;
  onExpandedDownload: () => void;
}

export function MediaCard({
  card,
  onCompactChoiceChange,
  onConfigChange,
  onCompactDownload,
  onExpandedDownload,
}: MediaCardProps) {
  const { metadata } = card;
  const compactChoices = getCompactChoices(metadata);
  const compactChoice = compactChoices.find((choice) => choice.id === card.compactChoiceId) ?? compactChoices[0] ?? null;
  const normalizedConfig = coerceExpandedConfig(metadata, card.config);
  const videoFormats = getVideoFormats(metadata);
  const audioFormats = getAudioOnlyFormats(metadata);
  const activeVideo = videoFormats.find((format) => format.format_id === normalizedConfig.videoFormatId) ?? videoFormats[0] ?? null;
  const allowsManualAudio = Boolean(activeVideo ? !hasAudio(activeVideo) : true);
  const hasVideoStream = Boolean(activeVideo);
  const hasAudioStream = activeVideo ? hasAudio(activeVideo) || audioFormats.length > 0 : audioFormats.length > 0;
  const containerOptions = getCompatibleContainers(hasVideoStream, hasAudioStream);
  const videoCodecOptions = normalizedConfig.container
    ? getVideoCodecOptions(normalizedConfig.container, hasVideoStream)
    : [];
  const audioCodecOptions = normalizedConfig.container
    ? getAudioCodecOptions(normalizedConfig.container, hasAudioStream)
    : [];
  const hasDownloads = compactChoices.length > 0;
  const compactSummary = compactChoice ? describeCompactSelection(metadata, compactChoice.id) : "No format options";
  const expandedSummary = hasDownloads ? describeSelection(metadata, normalizedConfig) : "No format options";
  const mediaBadge = getMediaBadgeLabel(metadata);
  const platform = getPlatformLabel(card.url);
  const thumbnail = metadata.thumbnail || "";

  return (
    <Card className="nodus-surface overflow-hidden animate-fade-up">
      <div className="grid gap-5 p-5 lg:grid-cols-[13.75rem,minmax(0,1fr)]">
        <div className="relative">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={`${metadata.title} thumbnail`}
              className="aspect-video w-full rounded-[1.2rem] border border-white/8 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-[1.2rem] border border-white/8 bg-white/[0.04] text-sm text-muted-foreground">
              Preview unavailable
            </div>
          )}

          <div className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/8 bg-black/60 px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--accent-2)] shadow-lg backdrop-blur">
            {platform}
          </div>
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid min-w-0 gap-3">
              <h3 className="text-balance font-display text-4xl leading-[0.95] tracking-[-0.04em] text-foreground md:text-5xl">
                {metadata.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                <span className="truncate">{getDomainFromUrl(card.url)}</span>
                <span className="nodus-dot" />
                <span>{formatDuration(metadata.duration)}</span>
                {getApproxSize(activeVideo ?? audioFormats[0] ?? metadata.formats[0]) > 0 ? (
                  <>
                    <span className="nodus-dot" />
                    <span>{formatBytes(getApproxSize(activeVideo ?? audioFormats[0] ?? metadata.formats[0]))}</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{mediaBadge}</Badge>
              <Badge>{platform}</Badge>
            </div>
          </div>

          <p className="flex flex-wrap items-center gap-2 text-sm text-foreground/90 md:text-base">
            <Sparkles className="size-4 text-[color:var(--accent)]" />
            <span>{compactSummary}</span>
          </p>
        </div>
      </div>

      <Separator className="bg-white/[0.05]" />

      <div className="grid gap-3 p-5 lg:grid-cols-[3.25rem,13rem,minmax(0,1fr),auto,auto] lg:items-center">
        <Button
          variant="secondary"
          size="icon"
          onClick={() =>
            onConfigChange((current) => ({
              ...current,
              isExpanded: !current.isExpanded,
            }))
          }
          aria-label={normalizedConfig.isExpanded ? "Collapse details" : "Expand details"}
        >
          {normalizedConfig.isExpanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
        </Button>

        <Select
          value={compactChoice?.id}
          onValueChange={(value) => onCompactChoiceChange(value)}
          disabled={!hasDownloads || card.download.status === "pending"}
        >
          <SelectTrigger className="h-12">
            <SelectValue placeholder={compactChoice ? compactChoice.label : "No formats"} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{compactChoice?.kind === "audio" ? "Audio options" : "Quick quality"}</SelectLabel>
              {compactChoices.map((choice) => (
                <SelectItem key={choice.id} value={choice.id}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="hidden min-w-0 truncate text-sm text-muted-foreground lg:block">{compactChoice?.detail}</div>

        <Button
          variant="secondary"
          className="h-12 px-5"
          onClick={() =>
            onConfigChange((current) => ({
              ...current,
              isExpanded: true,
            }))
          }
        >
          Configure
        </Button>

        <Button className="h-12 px-6" onClick={onCompactDownload} disabled={!hasDownloads || card.download.status === "pending"}>
          <Download className="size-4" />
          {card.download.status === "pending" ? "Downloading..." : "Download"}
        </Button>
      </div>

      {normalizedConfig.isExpanded ? (
        <div className="border-t border-white/[0.05] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] p-5">
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-[1.4rem] border border-white/[0.06] bg-white/[0.03] p-5 shadow-insetLine">
              <div className="grid gap-4">
                <div>
                  <h4 className="font-display text-3xl tracking-[-0.03em] text-foreground">Input</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pick the exact streams that will be sent to the backend.
                  </p>
                </div>

                {videoFormats.length > 0 ? (
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-muted-foreground">Source video</label>
                    <Select
                      value={normalizedConfig.videoFormatId ?? undefined}
                      onValueChange={(value) =>
                        onConfigChange((current) =>
                          coerceExpandedConfig(metadata, {
                            ...current,
                            videoFormatId: value,
                          }),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose video format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Video-bearing formats</SelectLabel>
                          {videoFormats.map((format) => (
                            <SelectItem key={format.format_id} value={format.format_id}>
                              {buildVideoFormatLabel(format)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="rounded-[1rem] border border-[color:var(--line)] bg-black/20 px-4 py-3 text-sm text-muted-foreground">
                    Backend returned only audio-bearing formats for this URL.
                  </div>
                )}

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Source audio</label>
                  <Select
                    value={normalizedConfig.audioFormatId === "auto" ? "auto" : normalizedConfig.audioFormatId}
                    onValueChange={(value) =>
                      onConfigChange((current) =>
                        coerceExpandedConfig(metadata, {
                          ...current,
                          audioFormatId: value === "auto" ? "auto" : value,
                        }),
                      )
                    }
                    disabled={!allowsManualAudio || audioFormats.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose audio stream" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Audio-only formats</SelectLabel>
                        <SelectItem value="auto">Auto | best available audio</SelectItem>
                        {audioFormats.map((format) => (
                          <SelectItem key={format.format_id} value={format.format_id}>
                            {buildAudioFormatLabel(format)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {allowsManualAudio
                      ? audioFormats.length > 0
                        ? "If the video stream is separate, Nodus will attach your chosen audio track."
                        : "No standalone audio streams were returned for this media."
                      : "The selected video already includes audio, so the separate audio selector is locked."}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.4rem] border border-white/[0.06] bg-white/[0.03] p-5 shadow-insetLine">
              <div className="grid gap-4">
                <div>
                  <h4 className="font-display text-3xl tracking-[-0.03em] text-foreground">Output</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Original sends only the chosen streams. Remux changes container. Convert uses ffmpeg codecs.
                  </p>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Output mode</label>
                  <ToggleGroup
                    type="single"
                    value={normalizedConfig.mode}
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }

                      onConfigChange((current) => ({
                        ...current,
                        mode: value as ExpandedMode,
                      }));
                    }}
                    className="grid w-full grid-cols-1 gap-2 md:grid-cols-3"
                  >
                    <ToggleGroupItem value="original" className="w-full">
                      Original
                    </ToggleGroupItem>
                    <ToggleGroupItem value="remux" className="w-full">
                      Remux
                    </ToggleGroupItem>
                    <ToggleGroupItem value="convert" className="w-full">
                      Convert
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Container</label>
                  <Select
                    value={normalizedConfig.container ?? undefined}
                    onValueChange={(value) =>
                      onConfigChange((current) =>
                        coerceExpandedConfig(metadata, {
                          ...current,
                          container: value,
                        }),
                      )
                    }
                    disabled={normalizedConfig.mode === "original" || containerOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose container" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Compatible containers</SelectLabel>
                        {containerOptions.map((container) => (
                          <SelectItem key={container} value={container}>
                            {container.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-muted-foreground">Target video codec</label>
                    <Select
                      value={normalizedConfig.vcodec ?? undefined}
                      onValueChange={(value) =>
                        onConfigChange((current) =>
                          coerceExpandedConfig(metadata, {
                            ...current,
                            vcodec: value,
                          }),
                        )
                      }
                      disabled={normalizedConfig.mode !== "convert" || videoCodecOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No video stream" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Video codecs</SelectLabel>
                          {videoCodecOptions.map((codec) => (
                            <SelectItem key={codec} value={codec}>
                              {codec.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-muted-foreground">Target audio codec</label>
                    <Select
                      value={normalizedConfig.acodec ?? undefined}
                      onValueChange={(value) =>
                        onConfigChange((current) =>
                          coerceExpandedConfig(metadata, {
                            ...current,
                            acodec: value,
                          }),
                        )
                      }
                      disabled={normalizedConfig.mode !== "convert" || audioCodecOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No audio stream" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Audio codecs</SelectLabel>
                          {audioCodecOptions.map((codec) => (
                            <SelectItem key={codec} value={codec}>
                              {codec.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-[1.4rem] border border-white/[0.06] bg-black/20 p-5 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ready to download</span>
              <p className="text-sm text-foreground md:text-base">{expandedSummary}</p>
              {card.download.status === "error" && card.download.message ? (
                <p className="text-sm text-destructive">{card.download.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="secondary"
                className="h-12 px-6"
                onClick={() =>
                  onConfigChange((current) => ({
                    ...current,
                    isExpanded: false,
                  }))
                }
              >
                Collapse
              </Button>

              <Button className="h-12 px-6" onClick={onExpandedDownload} disabled={!hasDownloads || card.download.status === "pending"}>
                <Download className="size-4" />
                {card.download.status === "pending" ? "Downloading..." : "Download"}
              </Button>
            </div>
          </div>
        </div>
      ) : card.download.status === "error" && card.download.message ? (
        <div className="border-t border-white/[0.05] px-5 pb-5 pt-4 text-sm text-destructive">{card.download.message}</div>
      ) : null}
    </Card>
  );
}
