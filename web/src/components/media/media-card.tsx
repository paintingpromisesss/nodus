import { Check, ChevronDown, ChevronUp, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { t, type Language } from "@/lib/i18n";
import { PlatformIcon, resolvePlatform } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import {
  buildAudioFormatLabel,
  buildMuxedFormatLabel,
  buildVideoFormatLabel,
  coerceExpandedConfig,
  describeCompactSelection,
  describeSelection,
  formatContainerDisplay,
  formatDuration,
  getAudioCodecOptions,
  getAudioOnlyFormats,
  getCompactChoices,
  getCompatibleContainersForConfig,
  getDefaultContainerForConfig,
  getMediaBadgeLabel,
  getOriginalContainerDisplay,
  getSourceCodecsForConfig,
  getVideoCodecOptions,
  getVideoFormats,
  hasAudio,
  isMuxed,
  isVideoOnly,
  splitCompatibleContainers,
  type ExpandedConfig,
  type ExpandedMode,
  type QuickQualityMode,
  type SuccessMediaCard,
} from "@/lib/media";

interface MediaCardProps {
  card: SuccessMediaCard;
  onCompactChoiceChange: (compactChoiceId: string) => void;
  onQuickQualityModeChange: (quickQualityMode: QuickQualityMode) => void;
  onConfigChange: (updater: (current: ExpandedConfig) => ExpandedConfig) => void;
  onCompactDownload: () => void;
  onExpandedDownload: () => void;
  language: Language;
  className?: string;
}

const EMPTY_SELECT_VALUE = "__empty__";

export function MediaCard({
  card,
  onCompactChoiceChange,
  onQuickQualityModeChange,
  onConfigChange,
  onCompactDownload,
  onExpandedDownload,
  language,
  className,
}: MediaCardProps) {
  const { metadata } = card;
  const compactChoices = getCompactChoices(metadata, card.quickQualityMode, language);
  const compatibilityChoices = getCompactChoices(metadata, "compatibility", language);
  const compactChoice = compactChoices.find((choice) => choice.id === card.compactChoiceId) ?? compactChoices[0] ?? null;
  const normalizedConfig = coerceExpandedConfig(metadata, card.config);
  const videoFormats = getVideoFormats(metadata);
  const videoOnlyFormats = videoFormats.filter(isVideoOnly);
  const muxedVideoFormats = videoFormats.filter(isMuxed);
  const audioFormats = getAudioOnlyFormats(metadata);
  const selectedAudioValue = normalizedConfig.audioFormatId === "auto"
    ? (audioFormats[0]?.format_id ?? EMPTY_SELECT_VALUE)
    : normalizedConfig.audioFormatId;
  const activeVideo = videoFormats.find((format) => format.format_id === normalizedConfig.videoFormatId) ?? videoFormats[0] ?? null;
  const allowsManualAudio = Boolean(activeVideo ? !hasAudio(activeVideo) : true);
  const muxedAudioLabel = activeVideo && hasAudio(activeVideo) ? buildMuxedFormatLabel(activeVideo, language).audioLine : null;
  const isVideoToggleLocked = Boolean(
    normalizedConfig.includeAudio && activeVideo && hasAudio(activeVideo) && audioFormats.length === 0,
  );
  const isAudioToggleLocked = Boolean(
    normalizedConfig.includeVideo && activeVideo && hasAudio(activeVideo),
  );
  const hasSelectedSources = normalizedConfig.includeVideo || normalizedConfig.includeAudio;
  const hasVideoStream = normalizedConfig.includeVideo && Boolean(activeVideo);
  const hasAudioStream = normalizedConfig.includeAudio
    && (hasVideoStream ? hasAudio(activeVideo!) || audioFormats.length > 0 : audioFormats.length > 0);
  const usesMuxedSource = Boolean(normalizedConfig.includeVideo && activeVideo && isMuxed(activeVideo));
  const containerOptions = hasSelectedSources ? getCompatibleContainersForConfig(metadata, normalizedConfig) : [];
  const defaultContainer =
    hasSelectedSources && normalizedConfig.mode !== "original" && usesMuxedSource
      ? getDefaultContainerForConfig(metadata, normalizedConfig)
      : null;
  const originalContainerDisplay = hasSelectedSources ? getOriginalContainerDisplay(metadata, normalizedConfig) : null;
  const originalContainerLabel = formatContainerDisplay(originalContainerDisplay, { language });
  const formatContainerOptionLabel = (container: string) =>
    `${container.toUpperCase()}${container === defaultContainer ? ` (${t(language, "defaultSuffix")})` : ""}`;
  const { audioOnly: audioOnlyContainers, videoCapable: videoCapableContainers } =
    splitCompatibleContainers(containerOptions);
  const sourceCodecs = getSourceCodecsForConfig(metadata, normalizedConfig);
  const videoCodecOptions = normalizedConfig.container
    ? normalizedConfig.mode === "original"
      ? [sourceCodecs.video].filter((codec): codec is string => Boolean(codec))
      : getVideoCodecOptions(normalizedConfig.container, hasVideoStream, sourceCodecs.video)
    : [];
  const audioCodecOptions = normalizedConfig.container
    ? normalizedConfig.mode === "original"
      ? [sourceCodecs.audio].filter((codec): codec is string => Boolean(codec))
      : getAudioCodecOptions(normalizedConfig.container, hasAudioStream, sourceCodecs.audio)
    : [];
  const hasDownloads = compactChoices.length > 0;
  const hasCompatibilityDownloads = compatibilityChoices.length > 0;
  const compactSummary = compactChoice
    ? describeCompactSelection(metadata, compactChoice.id, card.quickQualityMode, normalizedConfig, language)
    : t(language, "formatsMissing");
  const isQuickQualityOverrideEnabled = normalizedConfig.overrideQuickQuality;
  const isInputSectionDisabled = !isQuickQualityOverrideEnabled;
  const canChooseContainer =
    hasSelectedSources && normalizedConfig.mode !== "original" && containerOptions.length > 0;
  const canChooseVideoCodec =
    normalizedConfig.includeVideo && normalizedConfig.mode === "convert" && videoCodecOptions.length > 0;
  const canChooseAudioCodec =
    normalizedConfig.includeAudio && normalizedConfig.mode === "convert" && audioCodecOptions.length > 0;
  const expandedSummary = hasDownloads
    ? hasSelectedSources
      ? describeSelection(metadata, normalizedConfig, language)
      : t(language, "chooseVideoOrAudio")
    : t(language, "formatsMissing");
  const isQuickQualityDisabled = isQuickQualityOverrideEnabled || !hasDownloads || card.download.status === "pending";
  const activeDownloadSummary = isQuickQualityOverrideEnabled ? expandedSummary : compactSummary;
  const mediaBadge = getMediaBadgeLabel(metadata, language);
  const sourceUrl = metadata.original_url || card.url;
  const platform = resolvePlatform(sourceUrl);
  const thumbnail = metadata.thumbnail || "";
  const videoCodecDisplay = normalizedConfig.includeVideo
    ? normalizedConfig.vcodec
      ? normalizedConfig.vcodec === sourceCodecs.video
        ? `Copy (${normalizedConfig.vcodec.toUpperCase()})`
        : normalizedConfig.vcodec.toUpperCase()
      : t(language, "noVideoSelected")
    : t(language, "noVideoSelected");
  const audioCodecDisplay = normalizedConfig.includeAudio
    ? normalizedConfig.acodec
      ? normalizedConfig.acodec === sourceCodecs.audio
        ? `Copy (${normalizedConfig.acodec.toUpperCase()})`
        : normalizedConfig.acodec.toUpperCase()
      : t(language, "noAudioSelected")
    : t(language, "noAudioSelected");

  const isExpandedDownloadDisabled = !hasDownloads || card.download.status === "pending" || !hasSelectedSources;
  return (
    <Card className={cn("nodus-surface relative overflow-hidden animate-fade-up", className)}>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={language === "en" ? `Open the original link on ${platform.label}` : `Открыть исходную ссылку на ${platform.label}`}
        className="absolute right-5 top-5 z-10 flex size-11 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-black/30 text-foreground/80 backdrop-blur transition-colors duration-200 hover:border-[color:var(--line-strong)] hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:right-6 lg:top-6"
      >
        <PlatformIcon platform={platform} />
      </a>

      <div className="grid gap-6 p-5 lg:grid-cols-[15rem,minmax(0,1fr)] lg:p-6">
        <div className="relative lg:self-start">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={language === "en" ? `${metadata.title} thumbnail` : `Превью ${metadata.title}`}
              className="aspect-[1.16] w-full rounded-[1.35rem] border border-white/8 object-cover shadow-soft-glow"
              loading="lazy"
            />
          ) : (
            <div className="flex aspect-[1.16] items-center justify-center rounded-[1.35rem] border border-white/8 bg-white/[0.04] text-sm text-muted-foreground">
              {t(language, "noPreview")}
            </div>
          )}
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid min-w-0 gap-3">
              <h3 className="text-balance font-display text-4xl leading-[0.95] tracking-[-0.04em] text-foreground md:text-5xl">
                {metadata.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                <span>{formatDuration(metadata.duration, language)}</span>
                <span className="nodus-dot" />
                <span>{mediaBadge}</span>
              </div>

              <div className="rounded-full border border-[color:var(--line)] bg-black/20 px-3 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground w-fit">
                {metadata.formats.length} {t(language, "streamsFound")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-white/[0.05]" />

      <div className="grid gap-3 p-5 lg:grid-cols-[3.25rem,auto,minmax(0,1fr)] lg:items-center lg:p-6">
        <Button
          variant="secondary"
          size="icon"
          onClick={() =>
            onConfigChange((current) => ({
              ...current,
              isExpanded: !current.isExpanded,
            }))
          }
          aria-label={normalizedConfig.isExpanded ? t(language, "hideAdvanced") : t(language, "showAdvanced")}
        >
          {normalizedConfig.isExpanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
        </Button>

        <div className="flex min-w-0 items-center gap-2 transition-opacity duration-200">
          <Select
            value={compactChoice?.id ?? EMPTY_SELECT_VALUE}
            onValueChange={(value) => onCompactChoiceChange(value)}
            disabled={isQuickQualityDisabled}
          >
            <SelectTrigger className="h-12 w-32 shrink-0">
              <SelectValue placeholder={compactChoice ? compactChoice.label : t(language, "noDownloads")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{compactChoice?.kind === "audio" ? t(language, "audioDownloads") : t(language, "quickDownloads")}</SelectLabel>
                {compactChoices.map((choice) => (
                  <SelectItem key={choice.id} value={choice.id}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <div
            role="radiogroup"
            aria-label={t(language, "quickPreference")}
            className={cn(
              "relative flex h-12 w-[17rem] shrink-0 items-center rounded-2xl border border-[color:var(--line)] bg-black/20 p-1 transition-colors",
              isQuickQualityDisabled ? "opacity-50" : "hover:border-[color:var(--line-strong)]",
            )}
          >
            <span
              className={cn(
                "absolute inset-y-1 left-1 w-[calc((100%_-_0.5rem)/3)] rounded-[calc(theme(borderRadius.2xl)-0.25rem)] border border-[color:var(--line-strong)] bg-[rgba(223,192,143,0.14)] transition-transform duration-200",
                card.quickQualityMode === "quality" && "translate-x-0",
                card.quickQualityMode === "size" && "translate-x-full",
                card.quickQualityMode === "compatibility" && "translate-x-[200%]",
              )}
              aria-hidden="true"
            />
            <button
              type="button"
              role="radio"
              aria-checked={card.quickQualityMode === "quality"}
              onClick={() => onQuickQualityModeChange("quality")}
              disabled={isQuickQualityDisabled}
              className={cn(
                "relative z-10 flex h-full min-w-0 flex-1 items-center justify-center px-1.5 text-center text-[9px] uppercase leading-tight transition-colors",
                isQuickQualityDisabled ? "cursor-not-allowed" : "cursor-pointer",
                card.quickQualityMode === "quality" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t(language, "bestQuality")}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={card.quickQualityMode === "size"}
              onClick={() => onQuickQualityModeChange("size")}
              disabled={isQuickQualityDisabled}
              className={cn(
                "relative z-10 flex h-full min-w-0 flex-1 items-center justify-center px-1.5 text-center text-[9px] uppercase leading-tight transition-colors",
                isQuickQualityDisabled ? "cursor-not-allowed" : "cursor-pointer",
                card.quickQualityMode === "size" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t(language, "smallerFile")}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={card.quickQualityMode === "compatibility"}
              onClick={() => onQuickQualityModeChange("compatibility")}
              disabled={isQuickQualityDisabled || !hasCompatibilityDownloads}
              className={cn(
                "relative z-10 flex h-full min-w-0 flex-1 items-center justify-center px-1.5 text-center text-[9px] uppercase leading-tight transition-colors",
                isQuickQualityDisabled || !hasCompatibilityDownloads ? "cursor-not-allowed opacity-45" : "cursor-pointer",
                card.quickQualityMode === "compatibility" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t(language, "easyPlayback")}
            </button>
          </div>
        </div>

        <div className="flex min-w-0 w-full items-center justify-end gap-3">
          <div className="hidden min-w-0 w-fit max-w-full items-center gap-2 truncate rounded-full border border-[color:var(--line)] bg-black/20 px-3 py-2 text-sm text-foreground/90 lg:flex">
            <Sparkles className="size-4 shrink-0 text-[color:var(--accent)]" />
            <span className="truncate">{activeDownloadSummary}</span>
          </div>

          <Button
            size="icon"
            className="size-12 shrink-0"
            onClick={isQuickQualityOverrideEnabled ? onExpandedDownload : onCompactDownload}
            disabled={isQuickQualityOverrideEnabled ? isExpandedDownloadDisabled : !hasDownloads || card.download.status === "pending"}
            aria-label={card.download.status === "pending" ? t(language, "preparingDownload") : t(language, "downloadAria")}
            title={card.download.status === "pending" ? t(language, "preparingDownload") : t(language, "downloadAria")}
          >
            <Download className="size-4" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows,opacity,border-color] duration-300 ease-out",
          normalizedConfig.isExpanded
            ? "grid-rows-[1fr] border-t border-white/[0.05] opacity-100"
            : "grid-rows-[0fr] border-t border-transparent opacity-0",
        )}
        aria-hidden={!normalizedConfig.isExpanded}
      >
        <div className="min-h-0">
          <div
            className={cn(
              "p-5 transition-[transform,opacity] duration-300 ease-out",
              normalizedConfig.isExpanded ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
            )}
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <section
                className="rounded-[1.55rem] border border-white/[0.06] bg-white/[0.03] p-5 shadow-insetLine"
              >
                <div className="relative grid gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      onConfigChange((current) => ({
                        ...current,
                        overrideQuickQuality: !current.overrideQuickQuality,
                      }))
                    }
                    className={cn(
                      "absolute right-0 top-0 inline-flex h-8 w-14 shrink-0 items-center rounded-full border p-1 transition-colors",
                      isQuickQualityOverrideEnabled
                        ? "border-[color:var(--line-strong)] bg-[rgba(223,192,143,0.12)] text-[color:var(--accent-2)]"
                        : "border-[color:var(--line)] bg-black/20 text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={isQuickQualityOverrideEnabled}
                    aria-label={t(language, "useAdvancedForDownload")}
                    title={t(language, "useAdvanced")}
                  >
                    <span
                      className={cn(
                        "relative block h-full w-full rounded-full transition-colors",
                        isQuickQualityOverrideEnabled
                          ? "bg-[rgba(223,192,143,0.2)]"
                          : "bg-black/35",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-0.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-current transition-transform",
                          isQuickQualityOverrideEnabled ? "translate-x-6" : "translate-x-0",
                        )}
                      />
                    </span>
                  </button>

                  <div className="flex items-start justify-between gap-4 pr-16">
                    <div>
                      <h4 className="font-display text-3xl tracking-[-0.03em] text-foreground">{t(language, "sourceStreams")}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t(language, "sourceStreamsHelp")}
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "grid gap-4 transition-[opacity,filter] duration-200",
                      isInputSectionDisabled && "pointer-events-none opacity-45 saturate-50",
                    )}
                    aria-disabled={isInputSectionDisabled}
                  >
                    {videoFormats.length > 0 ? (
                      <div className={cn("grid gap-2 transition-opacity", !normalizedConfig.includeVideo && "opacity-60")}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isVideoToggleLocked) {
                              return;
                            }

                            onConfigChange((current) => ({
                              ...current,
                              includeVideo: !current.includeVideo,
                            }));
                          }}
                          disabled={isInputSectionDisabled || isVideoToggleLocked}
                          className={cn(
                            "inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors",
                            (isInputSectionDisabled || isVideoToggleLocked) ? "cursor-not-allowed opacity-70" : "hover:text-foreground",
                          )}
                          aria-pressed={normalizedConfig.includeVideo}
                        >
                          <span
                            className={cn(
                              "flex size-5 items-center justify-center rounded-full border transition-all",
                              normalizedConfig.includeVideo
                                ? "border-[color:var(--line-strong)] bg-[rgba(223,192,143,0.14)] text-[color:var(--accent-2)]"
                                : "border-[color:var(--line)] bg-black/20 text-transparent",
                            )}
                          >
                            <Check className="size-3" />
                          </span>
                          {t(language, "includeVideo")}
                        </button>
                        <Select
                          value={normalizedConfig.videoFormatId ?? EMPTY_SELECT_VALUE}
                        onValueChange={(value) =>
                          onConfigChange((current) =>
                            coerceExpandedConfig(metadata, {
                              ...current,
                              videoFormatId: value,
                              vcodec: null,
                              acodec: null,
                            }),
                          )
                        }
                          disabled={isInputSectionDisabled || !normalizedConfig.includeVideo}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t(language, "chooseVideoStream")} />
                          </SelectTrigger>
                          <SelectContent>
                            {videoOnlyFormats.length > 0 ? (
                              <SelectGroup>
                                <SelectLabel>{t(language, "videoOnlyStreams")}</SelectLabel>
                                {videoOnlyFormats.map((format) => (
                                  <SelectItem key={format.format_id} value={format.format_id}>
                                    {buildVideoFormatLabel(format, language)}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ) : null}

                            {videoOnlyFormats.length > 0 && muxedVideoFormats.length > 0 ? <SelectSeparator /> : null}

                            {muxedVideoFormats.length > 0 ? (
                              <SelectGroup>
                                <SelectLabel>{t(language, "videoStreamsWithAudio")}</SelectLabel>
                                {muxedVideoFormats.map((format) => (
                                  <SelectItem key={format.format_id} value={format.format_id}>
                                    {buildVideoFormatLabel(format, language)}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="rounded-[1rem] border border-[color:var(--line)] bg-black/20 px-4 py-3 text-sm text-muted-foreground">
                        {t(language, "linkAudioOnly")}
                      </div>
                    )}

                    <div className={cn("grid gap-2 transition-opacity", !normalizedConfig.includeAudio && "opacity-60")}>
                      <button
                        type="button"
                        onClick={() => {
                          if (isAudioToggleLocked) {
                            return;
                          }

                          onConfigChange((current) => ({
                            ...current,
                            includeAudio: !current.includeAudio,
                          }));
                        }}
                        disabled={isInputSectionDisabled || isAudioToggleLocked}
                        className={cn(
                          "inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors",
                          (isInputSectionDisabled || isAudioToggleLocked) ? "cursor-not-allowed opacity-70" : "hover:text-foreground",
                        )}
                        aria-pressed={normalizedConfig.includeAudio}
                      >
                        <span
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full border transition-all",
                            normalizedConfig.includeAudio
                              ? "border-[color:var(--line-strong)] bg-[rgba(223,192,143,0.14)] text-[color:var(--accent-2)]"
                              : "border-[color:var(--line)] bg-black/20 text-transparent",
                          )}
                        >
                          <Check className="size-3" />
                        </span>
                        {t(language, "includeAudio")}
                      </button>
                      {!allowsManualAudio && muxedAudioLabel ? (
                        <div className="flex h-11 w-full items-center justify-between rounded-[0.95rem] border border-[color:var(--line)] bg-white/[0.03] px-4 py-2 text-sm text-foreground opacity-50">
                          <span className="line-clamp-1">{muxedAudioLabel}</span>
                          <ChevronDown className="size-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <Select
                          value={selectedAudioValue}
                          onValueChange={(value) =>
                            onConfigChange((current) =>
                              coerceExpandedConfig(metadata, {
                                ...current,
                                audioFormatId: value,
                                acodec: null,
                              }),
                            )
                          }
                          disabled={isInputSectionDisabled || !normalizedConfig.includeAudio || audioFormats.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t(language, "chooseAudioStream")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>{t(language, "audioOnlyStreams")}</SelectLabel>
                              {audioFormats.map((format) => (
                                <SelectItem key={format.format_id} value={format.format_id}>
                                  {buildAudioFormatLabel(format, language)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-xs leading-5 text-muted-foreground">
                        {allowsManualAudio
                          ? audioFormats.length > 0
                            ? t(language, "whenSeparateAudio")
                            : t(language, "audioStreamMissing")
                          : t(language, "audioChoiceLocked")}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section
                className={cn(
                  "rounded-[1.55rem] border border-white/[0.06] bg-white/[0.03] p-5 shadow-insetLine transition-opacity",
                  !hasSelectedSources && "opacity-55",
                )}
              >
                <div className="grid gap-4">
                  <div>
                    <h4 className="font-display text-3xl tracking-[-0.03em] text-foreground">{t(language, "outputFile")}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t(language, "outputFileHelp")}
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-muted-foreground">{t(language, "howCreateFile")}</label>
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
                          container: current.mode === "original" && value !== "original" ? null : current.container,
                          vcodec: current.mode === "original" && value !== "original" ? null : current.vcodec,
                          acodec: current.mode === "original" && value !== "original" ? null : current.acodec,
                        }));
                      }}
                      className="grid w-full grid-cols-1 gap-2 md:grid-cols-3"
                    >
                      <ToggleGroupItem value="original" className="w-full">
                        {t(language, "keepOriginal")}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="remux" className="w-full">
                        {t(language, "repackage")}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="convert" className="w-full">
                        {t(language, "convert")}
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      {normalizedConfig.mode === "original" ? t(language, "containerAuto") : t(language, "outputContainer")}
                    </label>
                    {normalizedConfig.mode === "original" ? (
                      <ReadonlySelectField
                        label={hasSelectedSources ? originalContainerLabel : t(language, "noSourcesSelected")}
                      />
                    ) : (
                      <Select
                        value={normalizedConfig.container ?? EMPTY_SELECT_VALUE}
                        onValueChange={(value) =>
                          onConfigChange((current) =>
                            coerceExpandedConfig(metadata, {
                              ...current,
                              container: value,
                              vcodec: null,
                              acodec: null,
                            }),
                          )
                        }
                        disabled={!canChooseContainer}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t(language, "chooseOutputContainer")} />
                        </SelectTrigger>
                        <SelectContent>
                           {audioOnlyContainers.length > 0 ? (
                             <SelectGroup>
                               <SelectLabel>{t(language, "audioOnlyContainers")}</SelectLabel>
                               {audioOnlyContainers.map((container) => (
                                 <SelectItem key={container} value={container}>
                                   {formatContainerOptionLabel(container)}
                                 </SelectItem>
                               ))}
                             </SelectGroup>
                           ) : null}

                           {audioOnlyContainers.length > 0 && videoCapableContainers.length > 0 ? <SelectSeparator /> : null}

                           {videoCapableContainers.length > 0 ? (
                             <SelectGroup>
                               <SelectLabel>
                                 {audioOnlyContainers.length > 0 ? t(language, "videoContainers") : t(language, "compatibleContainers")}
                               </SelectLabel>
                               {videoCapableContainers.map((container) => (
                                 <SelectItem key={container} value={container}>
                                   {formatContainerOptionLabel(container)}
                                 </SelectItem>
                               ))}
                            </SelectGroup>
                          ) : null}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <div className={cn("grid gap-2 transition-opacity", !normalizedConfig.includeVideo && "opacity-60")}>
                      <label className="text-sm font-medium text-muted-foreground">
                        {normalizedConfig.mode === "convert" ? t(language, "convertVideoTo") : t(language, "videoCodec")}
                      </label>
                      {canChooseVideoCodec ? (
                        <Select
                          value={normalizedConfig.vcodec ?? EMPTY_SELECT_VALUE}
                          onValueChange={(value) =>
                            onConfigChange((current) =>
                              coerceExpandedConfig(metadata, {
                                ...current,
                              vcodec: value,
                            }),
                          )
                        }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t(language, "noVideoSelected")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>{t(language, "videoCodecOptions")}</SelectLabel>
                              {videoCodecOptions.map((codec) => (
                                <SelectItem key={codec} value={codec}>
                                  {codec === sourceCodecs.video ? `Copy (${codec.toUpperCase()})` : codec.toUpperCase()}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : (
                        <ReadonlySelectField label={videoCodecDisplay} />
                      )}
                    </div>

                    <div className={cn("grid gap-2 transition-opacity", !normalizedConfig.includeAudio && "opacity-60")}>
                      <label className="text-sm font-medium text-muted-foreground">
                        {normalizedConfig.mode === "convert" ? t(language, "convertAudioTo") : t(language, "audioCodec")}
                      </label>
                      {canChooseAudioCodec ? (
                        <Select
                          value={normalizedConfig.acodec ?? EMPTY_SELECT_VALUE}
                          onValueChange={(value) =>
                            onConfigChange((current) =>
                              coerceExpandedConfig(metadata, {
                                ...current,
                              acodec: value,
                            }),
                          )
                        }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t(language, "noAudioSelected")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>{t(language, "audioCodecOptions")}</SelectLabel>
                              {audioCodecOptions.map((codec) => (
                                <SelectItem key={codec} value={codec}>
                                  {codec === sourceCodecs.audio ? `Copy (${codec.toUpperCase()})` : codec.toUpperCase()}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : (
                        <ReadonlySelectField label={audioCodecDisplay} />
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

          </div>
        </div>
      </div>

      {!normalizedConfig.isExpanded && card.download.status === "error" && card.download.message ? (
        <div className="border-t border-white/[0.05] px-5 pb-5 pt-4 text-sm text-destructive">{card.download.message}</div>
      ) : null}
    </Card>
  );
}

function ReadonlySelectField({ label }: { label: string }) {
  return (
    <div className="flex h-11 w-full items-center justify-between rounded-[0.95rem] border border-[color:var(--line)] bg-white/[0.03] px-4 py-2 text-sm text-muted-foreground opacity-70">
      <span className="line-clamp-1">{label}</span>
      <ChevronDown className="size-4 text-muted-foreground" />
    </div>
  );
}
