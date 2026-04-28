import { getPlatformLabel as resolvePlatformLabel } from "@/lib/platforms";

export interface FetchMetadataStreamRequest {
  urls: string[];
  options?: {
    use_all_clients?: boolean;
  };
}

export interface DownloadRequest {
  url: string;
  format_id: string;
  options?: {
    container?: string;
    vcodec?: string;
    acodec?: string;
  };
}

export interface MediaFormat {
  format_id: string;
  format_note: string;
  filesize: number;
  filesize_approx: number;
  acodec: string;
  vcodec: string;
  audio_ext: string;
  video_ext: string;
  ext: string;
  container: string;
  width: number;
  height: number;
  fps: number;
  url: string;
  abr: number;
  vbr: number;
  resolution: string;
}

export interface MediaMetadata {
  id: string;
  title: string;
  thumbnail: string;
  is_live: boolean;
  media_type: string;
  original_url: string;
  duration: number;
  formats: MediaFormat[];
}

export type MetadataStreamEvent =
  | { event: "ready"; payload: { total: number } }
  | { event: "item"; payload: { index: number; url: string; data: MediaMetadata } }
  | { event: "error"; payload: { index: number; url: string; error: string } }
  | { event: "fatal"; payload: { error: string } }
  | { event: "done"; payload: { total: number } };

export type MediaCardState = "pending" | "success" | "error";
export type ExpandedMode = "original" | "remux" | "convert";
export type QuickQualityMode = "quality" | "size" | "compatibility";

export interface ExpandedConfig {
  isExpanded: boolean;
  overrideQuickQuality: boolean;
  includeVideo: boolean;
  includeAudio: boolean;
  videoFormatId: string | null;
  audioFormatId: string | "auto";
  mode: ExpandedMode;
  container: string | null;
  vcodec: string | null;
  acodec: string | null;
}

export interface DownloadFeedback {
  status: "idle" | "pending" | "error";
  message?: string;
}

export interface PendingMediaCard {
  state: "pending";
  index: number;
  url: string;
}

export interface ErrorMediaCard {
  state: "error";
  index: number;
  url: string;
  message: string;
}

export interface CompactChoice {
  id: string;
  kind: "video" | "audio";
  label: string;
  detail: string;
  preferredFormat: MediaFormat;
  formats: MediaFormat[];
}

export interface SuccessMediaCard {
  state: "success";
  index: number;
  url: string;
  metadata: MediaMetadata;
  compactChoiceId: string;
   quickQualityMode: QuickQualityMode;
  config: ExpandedConfig;
  download: DownloadFeedback;
}

export type MediaCard = PendingMediaCard | ErrorMediaCard | SuccessMediaCard;

export const CONTAINER_CODEC_RULES = {
  mp4: {
    video: ["h264", "hevc", "av1", "vp9"],
    audio: ["aac", "alac", "flac", "mp3", "opus"],
  },
  mov: {
    video: ["h264", "hevc"],
    audio: ["aac", "alac", "mp3", "pcm_s16le", "pcm_s24le", "pcm_f32le"],
  },
  m4a: {
    video: [],
    audio: ["aac", "alac", "mp3"],
  },
  webm: {
    video: ["vp9", "vp8", "av1"],
    audio: ["opus", "vorbis"],
  },
  ogg: {
    video: [],
    audio: ["opus", "vorbis", "flac"],
  },
  opus: {
    video: [],
    audio: ["opus"],
  },
  mp3: {
    video: [],
    audio: ["mp3"],
  },
  flac: {
    video: [],
    audio: ["flac"],
  },
  wav: {
    video: [],
    audio: ["pcm_s16le", "pcm_s24le", "pcm_f32le"],
  },
  mkv: {
    video: ["h264", "hevc", "av1", "vp9", "vp8"],
    audio: ["aac", "alac", "flac", "mp3", "opus", "pcm_s16le", "pcm_s24le", "pcm_f32le", "vorbis"],
  },
} as const;

type ContainerName = keyof typeof CONTAINER_CODEC_RULES;

interface ResolvedStreams {
  formatId: string;
  videoFormat: MediaFormat | null;
  audioFormat: MediaFormat | null;
  hasVideo: boolean;
  hasAudio: boolean;
}

interface SelectedStreams {
  videoFormat: MediaFormat | null;
  audioFormat: MediaFormat | null;
  hasVideo: boolean;
  hasAudio: boolean;
}

export function normalizeUrlInput(source: string) {
  const seen = new Set<string>();
  const urls: string[] = [];
  const invalidLines: string[] = [];

  for (const rawLine of source.split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (!isHttpUrl(line)) {
      invalidLines.push(line);
      continue;
    }

    if (seen.has(line)) {
      continue;
    }

    seen.add(line);
    urls.push(line);
  }

  return { urls, invalidLines };
}

export function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getDomainFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export function getPlatformLabel(value: string) {
  return resolvePlatformLabel(value);
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "Live / unknown";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) {
    return "Size n/a";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const digits = value >= 100 || index === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[index]}`;
}

export function getApproxSize(format?: MediaFormat | null) {
  if (!format) {
    return 0;
  }

  return format.filesize || format.filesize_approx || 0;
}

export function hasVideo(format: MediaFormat) {
  return Boolean(format.vcodec && format.vcodec !== "none");
}

export function hasAudio(format: MediaFormat) {
  return Boolean(format.acodec && format.acodec !== "none");
}

export function isMuxed(format: MediaFormat) {
  return hasVideo(format) && hasAudio(format);
}

export function isVideoOnly(format: MediaFormat) {
  return hasVideo(format) && !hasAudio(format);
}

export function isAudioOnly(format: MediaFormat) {
  return !hasVideo(format) && hasAudio(format);
}

export function getVideoFormats(metadata: MediaMetadata) {
  return metadata.formats.filter(hasVideo).sort(compareSourceVideoFormats);
}

export function getAudioOnlyFormats(metadata: MediaMetadata) {
  return metadata.formats.filter(isAudioOnly).sort(compareAudioFormats);
}

export function getMediaBadgeLabel(metadata: MediaMetadata) {
  const videoFormats = getVideoFormats(metadata);
  const audioFormats = getAudioOnlyFormats(metadata);

  if (videoFormats.length === 0 && audioFormats.length > 0) {
    return "Audio";
  }
  if (metadata.is_live) {
    return "Live";
  }

  return "Video";
}

export function getCompactChoices(metadata: MediaMetadata, mode: QuickQualityMode = "quality"): CompactChoice[] {
  const videoFormats = getVideoFormats(metadata)
    .filter(mode === "compatibility" ? isMuxed : isVideoOnly)
    .sort((left, right) => compareCompactVideoFormats(left, right, mode));

  if (videoFormats.length === 0) {
    if (mode === "compatibility") {
      return [];
    }

    return getAudioOnlyFormats(metadata).map((format) => ({
      id: `audio:${format.format_id}`,
      kind: "audio",
      label: describeAudioLine(format),
      detail: [format.ext.toUpperCase(), format.acodec.toUpperCase()].filter(Boolean).join(" | "),
      preferredFormat: format,
      formats: [format],
    }));
  }

  const grouped = new Map<string, MediaFormat[]>();
  for (const format of videoFormats) {
    const key = getQualityKey(format);
    const bucket = grouped.get(key) ?? [];
    bucket.push(format);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries())
    .map(([key, formats]) => {
      const sorted = [...formats].sort((left, right) => compareCompactVideoFormats(left, right, mode));
      const preferredFormat = sorted[0];

      return {
        id: `video:${key}`,
        kind: "video" as const,
        label: getQualityLabel(preferredFormat),
        detail: describeCompactPreference(preferredFormat),
        preferredFormat,
        formats: sorted,
      };
    })
    .sort((left, right) => compareCompactChoices(left, right));
}

export function createInitialExpandedConfig(metadata: MediaMetadata): ExpandedConfig {
  return syncExpandedConfigToCompactChoice(
    metadata,
    {
    isExpanded: false,
    overrideQuickQuality: false,
    includeVideo: getVideoFormats(metadata).length > 0,
    includeAudio: getVideoFormats(metadata).length > 0 || getAudioOnlyFormats(metadata).length > 0,
    videoFormatId: getVideoFormats(metadata)[0]?.format_id ?? null,
    audioFormatId: getVideoFormats(metadata).length > 0 ? "auto" : getAudioOnlyFormats(metadata)[0]?.format_id ?? "auto",
    mode: "original",
    container: null,
    vcodec: null,
    acodec: null,
    },
    getCompactChoices(metadata, "quality")[0]?.id ?? "",
    "quality",
  );
}

export function coerceExpandedConfig(metadata: MediaMetadata, draft: ExpandedConfig): ExpandedConfig {
  const videoFormats = getVideoFormats(metadata);
  const audioFormats = getAudioOnlyFormats(metadata);
  const requestedIncludeVideo = Boolean(draft.includeVideo && videoFormats.length > 0);
  const requestedIncludeAudio = Boolean(
    draft.includeAudio && (audioFormats.length > 0 || videoFormats.some((format) => hasAudio(format))),
  );

  const selectedVideoFormat =
    videoFormats.find((format) => format.format_id === draft.videoFormatId) ?? videoFormats[0] ?? null;
  const hasStandaloneAudioFallback = audioFormats.length > 0;
  const hasStandaloneVideoFallback = videoFormats.some(isVideoOnly);
  const includeVideo =
    !requestedIncludeVideo && requestedIncludeAudio && selectedVideoFormat && hasAudio(selectedVideoFormat) && !hasStandaloneAudioFallback
      ? true
      : requestedIncludeVideo;
  const includeAudio = includeVideo && selectedVideoFormat && hasAudio(selectedVideoFormat)
    ? true
    : requestedIncludeAudio;

  const effectiveVideoForAudio = includeVideo ? selectedVideoFormat : null;
  const audioMode =
    effectiveVideoForAudio && hasAudio(effectiveVideoForAudio)
      ? "auto"
      : draft.audioFormatId === "auto" || audioFormats.some((format) => format.format_id === draft.audioFormatId)
        ? draft.audioFormatId
        : audioFormats[0]?.format_id ?? "auto";

  const bestAudio = audioFormats[0] ?? null;
  const resolvedAudio =
    effectiveVideoForAudio && hasAudio(effectiveVideoForAudio)
      ? null
      : audioMode === "auto"
        ? bestAudio
        : audioFormats.find((format) => format.format_id === audioMode) ?? bestAudio;

  const selectedStreams = getSelectedStreams({
    includeVideo,
    includeAudio,
    selectedVideoFormat,
    resolvedAudio,
    videoFormats,
  });

  const containerOptions = getCompatibleContainersForSelection(selectedStreams, draft.mode);
  const container =
    draft.mode === "original"
      ? getOriginalOutputContainer(selectedStreams)
      : normalizeContainerChoice(
          draft.container,
          containerOptions,
          selectedStreams.hasVideo,
          selectedStreams.hasAudio,
          getResolvedSelectionContainer(selectedStreams),
        );
  const sourceVideoCodec = getFormatVideoCodec(selectedStreams.videoFormat);
  const sourceAudioCodec = getSelectedAudioCodec(selectedStreams);
  const videoCodecOptions = container ? getVideoCodecOptions(container, selectedStreams.hasVideo, sourceVideoCodec) : [];
  const audioCodecOptions = container ? getAudioCodecOptions(container, selectedStreams.hasAudio, sourceAudioCodec) : [];

  return {
    isExpanded: draft.isExpanded,
    overrideQuickQuality: Boolean(draft.overrideQuickQuality),
    includeVideo,
    includeAudio,
    videoFormatId: selectedVideoFormat?.format_id ?? null,
    audioFormatId: audioMode,
    mode: draft.mode,
    container,
    vcodec:
      draft.mode === "original"
        ? sourceVideoCodec
        : draft.mode === "convert" && videoCodecOptions.some((value) => value === draft.vcodec)
          ? draft.vcodec
          : videoCodecOptions[0] ?? null,
    acodec:
      draft.mode === "original"
        ? sourceAudioCodec
        : draft.mode === "convert" && audioCodecOptions.some((value) => value === draft.acodec)
          ? draft.acodec
          : audioCodecOptions[0] ?? null,
  };
}

export function getCompatibleContainers(hasVideoStream: boolean, hasAudioStream: boolean) {
  return (Object.keys(CONTAINER_CODEC_RULES) as ContainerName[]).filter((container) => {
    const rule = CONTAINER_CODEC_RULES[container];
    if (hasVideoStream && rule.video.length === 0) {
      return false;
    }
    return true;
  });
}

export function getCompatibleContainersForConfig(metadata: MediaMetadata, config: ExpandedConfig) {
  const normalized = coerceExpandedConfig(metadata, config);
  const resolved = resolveExpandedStreams(metadata, normalized);
  return getCompatibleContainersForResolvedStreams(resolved, normalized.mode);
}

export function getDefaultContainerForConfig(metadata: MediaMetadata, config: ExpandedConfig) {
  return coerceExpandedConfig(metadata, {
    ...config,
    container: null,
  }).container;
}

export function getOriginalContainerDisplay(metadata: MediaMetadata, config: ExpandedConfig) {
  const normalized = coerceExpandedConfig(metadata, {
    ...config,
    mode: "original",
  });
  const resolved = resolveExpandedStreams(metadata, normalized);
  const isSeparateVideoAudio = Boolean(resolved.videoFormat && resolved.audioFormat);

  if (isSeparateVideoAudio) {
    return {
      containers: getCompatibleContainersForResolvedStreams(resolved, "remux"),
      showDefault: false,
    };
  }

  return {
    containers: [normalized.container].filter((container): container is string => Boolean(container)),
    showDefault: true,
  };
}

export function formatContainerDisplay(
  display: { containers: string[]; showDefault: boolean } | null,
  options: { includeDefault?: boolean } = {},
) {
  if (!display?.containers.length) {
    return "No container";
  }

  const includeDefault = options.includeDefault ?? true;

  return `${display.containers.map((container) => container.toUpperCase()).join(" / ")}${
    includeDefault && display.showDefault ? " (default)" : ""
  }`;
}

export function splitCompatibleContainers(containers: string[]) {
  const audioOnly: string[] = [];
  const videoCapable: string[] = [];

  for (const container of containers) {
    if (!isKnownContainer(container)) {
      continue;
    }

    if (CONTAINER_CODEC_RULES[container].video.length === 0) {
      audioOnly.push(container);
      continue;
    }

    videoCapable.push(container);
  }

  return { audioOnly, videoCapable };
}

export function getVideoCodecOptions(container: string, hasVideoStream: boolean, sourceCodec?: string | null) {
  if (!hasVideoStream || !isKnownContainer(container)) {
    return [];
  }

  return prioritizeCodecOptions(CONTAINER_CODEC_RULES[container].video, sourceCodec ?? null);
}

export function getAudioCodecOptions(container: string, hasAudioStream: boolean, sourceCodec?: string | null) {
  if (!hasAudioStream || !isKnownContainer(container)) {
    return [];
  }

  return prioritizeCodecOptions(CONTAINER_CODEC_RULES[container].audio, sourceCodec ?? null);
}

export function getSourceCodecsForConfig(metadata: MediaMetadata, config: ExpandedConfig) {
  const normalized = coerceExpandedConfig(metadata, config);
  const resolved = resolveExpandedStreams(metadata, normalized);

  return {
    video: getResolvedVideoCodec(resolved),
    audio: getResolvedAudioCodec(resolved),
  };
}

export function buildCompactDownloadRequest(
  url: string,
  metadata: MediaMetadata,
  compactChoiceId: string,
  mode: QuickQualityMode = "quality",
  outputConfig?: ExpandedConfig,
): DownloadRequest {
  const resolved = resolveCompactStreams(metadata, compactChoiceId, mode);
  return buildDownloadRequestFromResolved(url, resolved, outputConfig);
}

function buildDownloadRequestFromResolved(
  url: string,
  resolved: ResolvedStreams,
  outputConfig?: ExpandedConfig,
): DownloadRequest {
  const request: DownloadRequest = { url, format_id: resolved.formatId };

  if (!outputConfig || outputConfig.mode === "original") {
    return request;
  }

  const options: DownloadRequest["options"] = {};

  if (outputConfig.container) {
    options.container = outputConfig.container;
  }

  if (outputConfig.mode === "remux") {
    validateContainerCodecSelection(
      outputConfig.container,
      getResolvedVideoCodec(resolved),
      getResolvedAudioCodec(resolved),
    );
  }

  if (outputConfig.mode === "convert") {
    validateContainerCodecSelection(
      outputConfig.container,
      resolved.hasVideo ? outputConfig.vcodec : null,
      resolved.hasAudio ? outputConfig.acodec : null,
    );

    if (resolved.hasVideo && outputConfig.vcodec) {
      options.vcodec = outputConfig.vcodec;
    }
    if (resolved.hasAudio && outputConfig.acodec) {
      options.acodec = outputConfig.acodec;
    }
  }

  if (Object.keys(options).length > 0) {
    request.options = options;
  }

  return request;
}

export function syncExpandedConfigToCompactChoice(
  metadata: MediaMetadata,
  config: ExpandedConfig,
  compactChoiceId: string,
  mode: QuickQualityMode = "quality",
): ExpandedConfig {
  const resolved = resolveCompactStreams(metadata, compactChoiceId, mode);

  return coerceExpandedConfig(metadata, {
    ...config,
    includeVideo: resolved.hasVideo,
    includeAudio: resolved.hasAudio,
    videoFormatId: resolved.videoFormat?.format_id ?? null,
    audioFormatId: resolved.audioFormat?.format_id ?? (resolved.hasAudio ? "auto" : config.audioFormatId),
    container: null,
    vcodec: null,
    acodec: null,
  });
}

export function buildExpandedDownloadRequest(
  url: string,
  metadata: MediaMetadata,
  config: ExpandedConfig,
): DownloadRequest {
  const normalized = coerceExpandedConfig(metadata, config);
  const resolved = resolveExpandedStreams(metadata, normalized);
  return buildDownloadRequestFromResolved(url, resolved, normalized);
}

export function resolveCompactStreams(
  metadata: MediaMetadata,
  compactChoiceId: string,
  mode: QuickQualityMode = "quality",
): ResolvedStreams {
  const choices = getCompactChoices(metadata, mode);
  const selectedChoice = choices.find((choice) => choice.id === compactChoiceId) ?? choices[0];

  if (!selectedChoice) {
    throw new Error("No downloadable formats were returned by the backend.");
  }

  if (selectedChoice.kind === "audio") {
    const audioFormat = selectedChoice.preferredFormat;
    return {
      formatId: audioFormat.format_id,
      videoFormat: null,
      audioFormat,
      hasVideo: false,
      hasAudio: true,
    };
  }

  const chosenVideo = selectedChoice.preferredFormat;
  if (hasAudio(chosenVideo)) {
    return {
      formatId: chosenVideo.format_id,
      videoFormat: chosenVideo,
      audioFormat: null,
      hasVideo: true,
      hasAudio: true,
    };
  }

  const bestAudio = getAudioOnlyFormats(metadata)[0] ?? null;
  return {
    formatId: bestAudio ? `${chosenVideo.format_id}+${bestAudio.format_id}` : chosenVideo.format_id,
    videoFormat: chosenVideo,
    audioFormat: bestAudio,
    hasVideo: true,
    hasAudio: Boolean(bestAudio),
  };
}

export function resolveExpandedStreams(metadata: MediaMetadata, config: ExpandedConfig): ResolvedStreams {
  const normalized = coerceExpandedConfig(metadata, config);
  const videoFormats = getVideoFormats(metadata);
  const audioFormats = getAudioOnlyFormats(metadata);
  const videoFormat =
    videoFormats.find((format) => format.format_id === normalized.videoFormatId) ?? videoFormats[0] ?? null;

  if (!normalized.includeVideo && !normalized.includeAudio) {
    throw new Error("Select at least one source stream.");
  }

  if (!normalized.includeVideo) {
    const audioFormat =
      normalized.audioFormatId === "auto"
        ? audioFormats[0] ?? null
        : audioFormats.find((format) => format.format_id === normalized.audioFormatId) ?? audioFormats[0] ?? null;

    if (!audioFormat) {
      throw new Error("No downloadable audio stream is available.");
    }

    return {
      formatId: audioFormat.format_id,
      videoFormat: null,
      audioFormat,
      hasVideo: false,
      hasAudio: true,
    };
  }

  if (!videoFormat) {
    const audioFormat =
      normalized.audioFormatId === "auto"
        ? audioFormats[0] ?? null
        : audioFormats.find((format) => format.format_id === normalized.audioFormatId) ?? audioFormats[0] ?? null;

    if (!audioFormat) {
      throw new Error("No downloadable audio stream is available.");
    }

    return {
      formatId: audioFormat.format_id,
      videoFormat: null,
      audioFormat,
      hasVideo: false,
      hasAudio: true,
    };
  }

  if (!normalized.includeAudio) {
    const standaloneVideo = isVideoOnly(videoFormat)
      ? videoFormat
      : findBestStandaloneVideoFormat(videoFormats, videoFormat);

    if (!standaloneVideo) {
      throw new Error("No standalone video stream is available for this media.");
    }

    return {
      formatId: standaloneVideo.format_id,
      videoFormat: standaloneVideo,
      audioFormat: null,
      hasVideo: true,
      hasAudio: false,
    };
  }

  if (hasAudio(videoFormat)) {
    return {
      formatId: videoFormat.format_id,
      videoFormat,
      audioFormat: null,
      hasVideo: true,
      hasAudio: true,
    };
  }

  const audioFormat =
    normalized.audioFormatId === "auto"
      ? audioFormats[0] ?? null
      : audioFormats.find((format) => format.format_id === normalized.audioFormatId) ?? audioFormats[0] ?? null;

  return {
    formatId: audioFormat ? `${videoFormat.format_id}+${audioFormat.format_id}` : videoFormat.format_id,
    videoFormat,
    audioFormat,
    hasVideo: true,
    hasAudio: Boolean(audioFormat),
  };
}

export function describeSelection(metadata: MediaMetadata, config: ExpandedConfig) {
  const normalized = coerceExpandedConfig(metadata, config);
  const resolved = resolveExpandedStreams(metadata, normalized);
  const originalContainerLabel =
    normalized.mode === "original"
      ? formatContainerDisplay(getOriginalContainerDisplay(metadata, normalized), { includeDefault: false })
      : null;

  return describeResolvedStreams(resolved, {
    containerOverride: normalized.container,
    containerLabelOverride: originalContainerLabel,
    videoCodecOverride: normalized.mode === "convert" ? normalized.vcodec : null,
    audioCodecOverride: normalized.mode === "convert" ? normalized.acodec : null,
  });
}

export function describeCompactSelection(
  metadata: MediaMetadata,
  compactChoiceId: string,
  mode: QuickQualityMode = "quality",
  outputConfig?: ExpandedConfig,
) {
  return describeResolvedStreamsWithOutput(resolveCompactStreams(metadata, compactChoiceId, mode), outputConfig);
}

export function describeResolvedStreams(
  resolved: ResolvedStreams,
  overrides?: {
    containerOverride?: string | null;
    containerLabelOverride?: string | null;
    videoCodecOverride?: string | null;
    audioCodecOverride?: string | null;
  },
) {
  const parts: string[] = [];
  const container = overrides?.containerOverride ?? getOriginalOutputContainer(resolved);

  const videoPart = buildSummaryVideoPart(
    resolved.videoFormat,
    overrides?.videoCodecOverride ?? getResolvedVideoCodec(resolved),
  );
  const audioPart = buildSummaryAudioPart(
    resolved,
    overrides?.audioCodecOverride ?? getResolvedAudioCodec(resolved),
  );
  const sizePart = buildSummarySizePart(resolved);

  if (videoPart) {
    parts.push(videoPart);
  }
  if (audioPart) {
    parts.push(audioPart);
  }
  const containerPart = overrides?.containerLabelOverride ?? buildSummaryContainerPart(container);
  if (containerPart) {
    parts.push(containerPart);
  }
  if (sizePart) {
    parts.push(sizePart);
  }

  return parts.join(" | ");
}

function describeResolvedStreamsWithOutput(resolved: ResolvedStreams, outputConfig?: ExpandedConfig) {
  if (!outputConfig) {
    return describeResolvedStreams(resolved);
  }

  if (outputConfig.mode === "original") {
    return describeResolvedStreams(resolved, {
      containerLabelOverride: formatContainerDisplay(getOriginalResolvedContainerDisplay(resolved), {
        includeDefault: false,
      }),
    });
  }

  return describeResolvedStreams(resolved, {
    containerOverride: outputConfig.container,
    videoCodecOverride: outputConfig.mode === "convert" ? outputConfig.vcodec : null,
    audioCodecOverride: outputConfig.mode === "convert" ? outputConfig.acodec : null,
  });
}

export function buildVideoFormatLabel(format: MediaFormat) {
  return [
    format.height > 0 && format.width > 0 ? `${format.width}x${format.height}` : getQualityLabel(format),
    format.fps > 0 ? `${Math.round(format.fps)} FPS` : null,
    format.vcodec && format.vcodec !== "none" ? format.vcodec.toUpperCase() : null,
    formatVideoBitrate(format),
    getApproxSize(format) > 0 ? formatBytes(getApproxSize(format)) : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

export function buildAudioFormatLabel(format: MediaFormat) {
  return [
    formatAudioBitrate(format),
    format.acodec && format.acodec !== "none" ? format.acodec.toUpperCase() : null,
    getApproxSize(format) > 0 ? formatBytes(getApproxSize(format)) : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

export function buildMuxedFormatLabel(format: MediaFormat) {
  return {
    videoLine: buildVideoFormatLabel(format),
    audioLine: buildAudioFormatLabel(format),
  };
}

function normalizeContainerChoice(
  current: string | null,
  available: string[],
  hasVideoStream: boolean,
  hasAudioStream: boolean,
  preferredContainer?: string | null,
) {
  if (current && available.includes(current)) {
    return current;
  }

  if (hasVideoStream && available.includes("mp4")) {
    return "mp4";
  }

  if (preferredContainer && available.includes(preferredContainer)) {
    return preferredContainer;
  }

  if (!hasVideoStream && hasAudioStream && available.includes("m4a")) {
    return "m4a";
  }
  if (!hasVideoStream && hasAudioStream && available.includes("mp3")) {
    return "mp3";
  }

  return available[0] ?? null;
}

function getResolvedSelectionContainer(selected: SelectedStreams | ResolvedStreams) {
  return selected.videoFormat?.ext ?? selected.audioFormat?.ext ?? null;
}

function getOriginalOutputContainer(streams: SelectedStreams | ResolvedStreams) {
  return getResolvedSelectionContainer(streams);
}

function getOriginalResolvedContainerDisplay(resolved: ResolvedStreams) {
  if (resolved.videoFormat && resolved.audioFormat) {
    return {
      containers: getCompatibleContainersForResolvedStreams(resolved, "remux"),
      showDefault: false,
    };
  }

  return {
    containers: [getOriginalOutputContainer(resolved)].filter((container): container is string => Boolean(container)),
    showDefault: true,
  };
}

function compareCompactChoices(left: CompactChoice, right: CompactChoice) {
  if (left.kind !== right.kind) {
    return left.kind === "video" ? -1 : 1;
  }

  const leftValue = left.preferredFormat.height || left.preferredFormat.abr || 0;
  const rightValue = right.preferredFormat.height || right.preferredFormat.abr || 0;

  return rightValue - leftValue;
}

function compareCompactVideoFormats(left: MediaFormat, right: MediaFormat, mode: QuickQualityMode) {
  const leftArea = (left.width || 0) * (left.height || 0);
  const rightArea = (right.width || 0) * (right.height || 0);
  if (leftArea !== rightArea) {
    return rightArea - leftArea;
  }

  const bitrateDelta = getCompactBitrate(right) - getCompactBitrate(left);
  if (mode === "quality" && bitrateDelta !== 0) {
    return bitrateDelta;
  }
  if (mode === "size" && bitrateDelta !== 0) {
    return -bitrateDelta;
  }

  if ((left.fps || 0) !== (right.fps || 0)) {
    return mode === "quality"
      ? (right.fps || 0) - (left.fps || 0)
      : (left.fps || 0) - (right.fps || 0);
  }

  const sizeDelta = getApproxSize(right) - getApproxSize(left);
  if (sizeDelta !== 0) {
    return mode === "quality" ? sizeDelta : -sizeDelta;
  }

  return (right.vbr || 0) - (left.vbr || 0);
}

function compareSourceVideoFormats(left: MediaFormat, right: MediaFormat) {
  const leftRank = isVideoOnly(left) ? 0 : isMuxed(left) ? 1 : 2;
  const rightRank = isVideoOnly(right) ? 0 : isMuxed(right) ? 1 : 2;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return compareCompactVideoFormats(left, right, "quality");
}

function compareAudioFormats(left: MediaFormat, right: MediaFormat) {
  if ((left.abr || 0) !== (right.abr || 0)) {
    return (right.abr || 0) - (left.abr || 0);
  }

  return getApproxSize(right) - getApproxSize(left);
}

function getCompactBitrate(format: MediaFormat) {
  return format.vbr || format.abr || 0;
}

function getQualityKey(format: MediaFormat) {
  if (format.height > 0) {
    return `${format.height}p`;
  }
  if (format.resolution) {
    return format.resolution;
  }
  return format.format_note || format.format_id;
}

function getQualityLabel(format: MediaFormat) {
  if (format.height > 0) {
    return `${format.height}p`;
  }
  if (format.resolution && format.resolution !== "audio only") {
    return format.resolution;
  }
  return format.format_note || "Unknown";
}

function describeCompactPreference(format: MediaFormat) {
  if (isMuxed(format)) {
    return `${format.ext.toUpperCase()} muxed`;
  }
  if (isVideoOnly(format)) {
    return `${format.ext.toUpperCase()} + best audio`;
  }
  return format.ext.toUpperCase();
}

function describeAudioLine(format: MediaFormat) {
  const parts = [];

  if (format.abr > 0) {
    parts.push(`${Math.round(format.abr)} kbps`);
  }
  parts.push(format.ext.toUpperCase());

  return parts.join(" | ");
}

function formatVideoBitrate(format: MediaFormat) {
  if (format.vbr > 0) {
    return `${Math.round(format.vbr)} kbps`;
  }

  if (format.abr > 0) {
    return `${Math.round(format.abr)} kbps`;
  }

  return null;
}

function formatAudioBitrate(format: MediaFormat) {
  if (format.abr > 0) {
    return `${Math.round(format.abr)} kbps`;
  }

  return null;
}

function findBestStandaloneVideoFormat(formats: MediaFormat[], preferred: MediaFormat) {
  const candidates = formats.filter(isVideoOnly);
  if (candidates.length === 0) {
    return null;
  }

  const exactHeight = candidates.find((format) => format.height > 0 && format.height === preferred.height);
  if (exactHeight) {
    return exactHeight;
  }

  const exactResolution = candidates.find(
    (format) =>
      format.width > 0 &&
      format.height > 0 &&
      format.width === preferred.width &&
      format.height === preferred.height,
  );
  if (exactResolution) {
    return exactResolution;
  }

  return candidates[0];
}

function isKnownContainer(value: string): value is ContainerName {
  return value in CONTAINER_CODEC_RULES;
}

function getSelectedStreams({
  includeVideo,
  includeAudio,
  selectedVideoFormat,
  resolvedAudio,
  videoFormats,
}: {
  includeVideo: boolean;
  includeAudio: boolean;
  selectedVideoFormat: MediaFormat | null;
  resolvedAudio: MediaFormat | null;
  videoFormats: MediaFormat[];
}): SelectedStreams {
  if (!includeVideo && !includeAudio) {
    return {
      videoFormat: null,
      audioFormat: null,
      hasVideo: false,
      hasAudio: false,
    };
  }

  if (!includeVideo) {
    return {
      videoFormat: null,
      audioFormat: includeAudio ? resolvedAudio : null,
      hasVideo: false,
      hasAudio: includeAudio && Boolean(resolvedAudio),
    };
  }

  if (!selectedVideoFormat) {
    return {
      videoFormat: null,
      audioFormat: includeAudio ? resolvedAudio : null,
      hasVideo: false,
      hasAudio: includeAudio && Boolean(resolvedAudio),
    };
  }

  if (!includeAudio) {
    const standaloneVideo = isVideoOnly(selectedVideoFormat)
      ? selectedVideoFormat
      : findBestStandaloneVideoFormat(videoFormats, selectedVideoFormat);

    return {
      videoFormat: standaloneVideo,
      audioFormat: null,
      hasVideo: Boolean(standaloneVideo),
      hasAudio: false,
    };
  }

  if (hasAudio(selectedVideoFormat)) {
    return {
      videoFormat: selectedVideoFormat,
      audioFormat: null,
      hasVideo: true,
      hasAudio: true,
    };
  }

  return {
    videoFormat: selectedVideoFormat,
    audioFormat: resolvedAudio,
    hasVideo: true,
    hasAudio: Boolean(resolvedAudio),
  };
}

function getCompatibleContainersForSelection(selected: SelectedStreams, mode: ExpandedMode) {
  return (Object.keys(CONTAINER_CODEC_RULES) as ContainerName[]).filter((container) => {
    const rule = CONTAINER_CODEC_RULES[container];

    if (selected.hasVideo && rule.video.length === 0) {
      return false;
    }

    if (mode !== "remux") {
      return selected.hasVideo || selected.hasAudio;
    }

    const videoCodec = getFormatVideoCodec(selected.videoFormat);
    const audioCodec = getSelectedAudioCodec(selected);

    if (videoCodec && !rule.video.some((codec) => codec === videoCodec)) {
      return false;
    }

    if (audioCodec && !rule.audio.some((codec) => codec === audioCodec)) {
      return false;
    }

    return selected.hasVideo || selected.hasAudio;
  });
}

function getCompatibleContainersForResolvedStreams(resolved: ResolvedStreams, mode: ExpandedMode) {
  return getCompatibleContainersForSelection(
    {
      videoFormat: resolved.videoFormat,
      audioFormat: resolved.audioFormat,
      hasVideo: resolved.hasVideo,
      hasAudio: resolved.hasAudio,
    },
    mode,
  );
}

function getFormatVideoCodec(format: MediaFormat | null) {
  if (!format || !hasVideo(format)) {
    return null;
  }

  return normalizeFormatVideoCodec(format.vcodec);
}

function getFormatAudioCodec(format: MediaFormat | null) {
  if (!format || !hasAudio(format)) {
    return null;
  }

  return normalizeFormatAudioCodec(format.acodec);
}

function getSelectedAudioCodec(selected: SelectedStreams) {
  return getFormatAudioCodec(selected.audioFormat) ?? getFormatAudioCodec(selected.videoFormat);
}

function getResolvedVideoCodec(resolved: ResolvedStreams) {
  return getFormatVideoCodec(resolved.videoFormat);
}

function getResolvedAudioCodec(resolved: ResolvedStreams) {
  return getFormatAudioCodec(resolved.audioFormat) ?? getFormatAudioCodec(resolved.videoFormat);
}

function validateContainerCodecSelection(
  container: string | null,
  vcodec: string | null,
  acodec: string | null,
) {
  const normalizedContainer = normalizeContainerValue(container);
  const normalizedVCodec = normalizeCodecValue(vcodec);
  const normalizedACodec = normalizeCodecValue(acodec);

  if (!normalizedContainer && !normalizedVCodec && !normalizedACodec) {
    return;
  }

  if (!normalizedContainer) {
    throw new Error("Container is required for codec selection.");
  }

  if (!isKnownContainer(normalizedContainer)) {
    throw new Error(`Unsupported container: ${normalizedContainer}`);
  }

  const rule = CONTAINER_CODEC_RULES[normalizedContainer];

  if (normalizedVCodec && !rule.video.some((codec) => codec === normalizedVCodec)) {
    throw new Error(`Container ${normalizedContainer.toUpperCase()} does not support video codec ${normalizedVCodec.toUpperCase()}.`);
  }

  if (normalizedACodec && !rule.audio.some((codec) => codec === normalizedACodec)) {
    throw new Error(`Container ${normalizedContainer.toUpperCase()} does not support audio codec ${normalizedACodec.toUpperCase()}.`);
  }
}

function normalizeContainerValue(container: string | null) {
  const normalized = container?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function normalizeCodecValue(codec: string | null) {
  const normalized = codec?.trim().toLowerCase() ?? "";
  if (!normalized || normalized === "none") {
    return null;
  }
  return normalized;
}

function prioritizeCodecOptions(codecs: readonly string[], preferredCodec: string | null) {
  const normalizedPreferred = normalizeCodecValue(preferredCodec);
  if (!normalizedPreferred || !codecs.some((codec) => codec === normalizedPreferred)) {
    return [...codecs];
  }

  return [normalizedPreferred, ...codecs.filter((codec) => codec !== normalizedPreferred)];
}

function buildSummaryVideoPart(format: MediaFormat | null, codec: string | null) {
  if (!format || !hasVideo(format)) {
    return null;
  }

  return [getQualityLabel(format), codec?.toUpperCase() ?? null].filter(Boolean).join(" ");
}

function buildSummaryAudioPart(resolved: ResolvedStreams, codec: string | null) {
  const audioSource = resolved.audioFormat ?? (resolved.videoFormat && hasAudio(resolved.videoFormat) ? resolved.videoFormat : null);
  if (!audioSource || !resolved.hasAudio) {
    return null;
  }

  return [
    formatAudioBitrate(audioSource),
    codec?.toUpperCase() ?? null,
  ].filter(Boolean).join(" ");
}

function buildSummaryContainerPart(container: string | null) {
  if (!container) {
    return null;
  }

  return container.toUpperCase();
}

function buildSummarySizePart(resolved: ResolvedStreams) {
  const totalSize = getResolvedTotalSize(resolved);
  if (totalSize <= 0) {
    return null;
  }

  return formatBytes(totalSize);
}

function getResolvedTotalSize(resolved: ResolvedStreams) {
  if (resolved.videoFormat && resolved.audioFormat) {
    return getApproxSize(resolved.videoFormat) + getApproxSize(resolved.audioFormat);
  }

  if (resolved.videoFormat) {
    return getApproxSize(resolved.videoFormat);
  }

  if (resolved.audioFormat) {
    return getApproxSize(resolved.audioFormat);
  }

  return 0;
}

function normalizeFormatVideoCodec(codec: string) {
  const normalized = normalizeCodecValue(codec);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("av01")) {
    return "av1";
  }
  if (normalized.startsWith("avc1") || normalized.startsWith("avc3") || normalized === "h264") {
    return "h264";
  }
  if (normalized.startsWith("hev1") || normalized.startsWith("hvc1") || normalized === "hevc") {
    return "hevc";
  }
  if (normalized.startsWith("vp09") || normalized === "vp9") {
    return "vp9";
  }
  if (normalized.startsWith("vp08") || normalized === "vp8") {
    return "vp8";
  }

  return normalized;
}

function normalizeFormatAudioCodec(codec: string) {
  const normalized = normalizeCodecValue(codec);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("mp4a") || normalized === "aac") {
    return "aac";
  }
  if (normalized === "alac") {
    return "alac";
  }
  if (normalized === "flac") {
    return "flac";
  }
  if (normalized === "mp3") {
    return "mp3";
  }
  if (normalized === "opus") {
    return "opus";
  }
  if (normalized === "vorbis") {
    return "vorbis";
  }
  if (normalized === "pcm_s16le" || normalized === "pcm_s24le" || normalized === "pcm_f32le") {
    return normalized;
  }

  return normalized;
}
