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

export interface ExpandedConfig {
  isExpanded: boolean;
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

const PLATFORM_MAP: Array<[needle: string, label: string]> = [
  ["youtube.", "YouTube"],
  ["youtu.be", "YouTube"],
  ["soundcloud.", "SoundCloud"],
  ["vimeo.", "Vimeo"],
  ["tiktok.", "TikTok"],
  ["instagram.", "Instagram"],
  ["x.com", "X"],
  ["twitter.", "X"],
];

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
  const domain = getDomainFromUrl(value).toLowerCase();
  const match = PLATFORM_MAP.find(([needle]) => domain.includes(needle));
  if (match) {
    return match[1];
  }

  const head = domain.split(".")[0] || domain;
  return head ? head.charAt(0).toUpperCase() + head.slice(1) : "Media";
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
  return metadata.formats.filter(hasVideo);
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

export function getCompactChoices(metadata: MediaMetadata): CompactChoice[] {
  const videoFormats = getVideoFormats(metadata).sort(compareCompactVideoFormats);

  if (videoFormats.length === 0) {
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
      const sorted = [...formats].sort(compareCompactVideoFormats);
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
  return coerceExpandedConfig(metadata, {
    isExpanded: false,
    videoFormatId: getVideoFormats(metadata)[0]?.format_id ?? null,
    audioFormatId: getVideoFormats(metadata).length > 0 ? "auto" : getAudioOnlyFormats(metadata)[0]?.format_id ?? "auto",
    mode: "original",
    container: null,
    vcodec: null,
    acodec: null,
  });
}

export function coerceExpandedConfig(metadata: MediaMetadata, draft: ExpandedConfig): ExpandedConfig {
  const videoFormats = getVideoFormats(metadata);
  const audioFormats = getAudioOnlyFormats(metadata);

  const selectedVideoFormat =
    videoFormats.find((format) => format.format_id === draft.videoFormatId) ?? videoFormats[0] ?? null;

  const audioMode =
    selectedVideoFormat && hasAudio(selectedVideoFormat)
      ? "auto"
      : draft.audioFormatId === "auto" || audioFormats.some((format) => format.format_id === draft.audioFormatId)
        ? draft.audioFormatId
        : audioFormats[0]?.format_id ?? "auto";

  const bestAudio = audioFormats[0] ?? null;
  const resolvedAudio =
    selectedVideoFormat && hasAudio(selectedVideoFormat)
      ? null
      : audioMode === "auto"
        ? bestAudio
        : audioFormats.find((format) => format.format_id === audioMode) ?? bestAudio;

  const streamProfile = {
    hasVideo: Boolean(selectedVideoFormat),
    hasAudio: selectedVideoFormat ? hasAudio(selectedVideoFormat) || Boolean(resolvedAudio) : Boolean(resolvedAudio),
  };

  const containerOptions = getCompatibleContainers(streamProfile.hasVideo, streamProfile.hasAudio);
  const container = normalizeContainerChoice(draft.container, containerOptions, streamProfile.hasVideo, streamProfile.hasAudio);
  const videoCodecOptions = container ? getVideoCodecOptions(container, streamProfile.hasVideo) : [];
  const audioCodecOptions = container ? getAudioCodecOptions(container, streamProfile.hasAudio) : [];

  return {
    isExpanded: draft.isExpanded,
    videoFormatId: selectedVideoFormat?.format_id ?? null,
    audioFormatId: audioMode,
    mode: draft.mode,
    container,
    vcodec: videoCodecOptions.some((value) => value === draft.vcodec) ? draft.vcodec : videoCodecOptions[0] ?? null,
    acodec: audioCodecOptions.some((value) => value === draft.acodec) ? draft.acodec : audioCodecOptions[0] ?? null,
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

export function getVideoCodecOptions(container: string, hasVideoStream: boolean) {
  if (!hasVideoStream || !isKnownContainer(container)) {
    return [];
  }

  return [...CONTAINER_CODEC_RULES[container].video];
}

export function getAudioCodecOptions(container: string, hasAudioStream: boolean) {
  if (!hasAudioStream || !isKnownContainer(container)) {
    return [];
  }

  return [...CONTAINER_CODEC_RULES[container].audio];
}

export function buildCompactDownloadRequest(
  url: string,
  metadata: MediaMetadata,
  compactChoiceId: string,
): DownloadRequest {
  const resolved = resolveCompactStreams(metadata, compactChoiceId);
  return { url, format_id: resolved.formatId };
}

export function buildExpandedDownloadRequest(
  url: string,
  metadata: MediaMetadata,
  config: ExpandedConfig,
): DownloadRequest {
  const normalized = coerceExpandedConfig(metadata, config);
  const resolved = resolveExpandedStreams(metadata, normalized);
  const request: DownloadRequest = {
    url,
    format_id: resolved.formatId,
  };

  if (normalized.mode === "original") {
    return request;
  }

  const options: DownloadRequest["options"] = {};

  if (normalized.container) {
    options.container = normalized.container;
  }

  if (normalized.mode === "convert") {
    if (resolved.hasVideo && normalized.vcodec) {
      options.vcodec = normalized.vcodec;
    }
    if (resolved.hasAudio && normalized.acodec) {
      options.acodec = normalized.acodec;
    }
  }

  if (Object.keys(options).length > 0) {
    request.options = options;
  }

  return request;
}

export function resolveCompactStreams(metadata: MediaMetadata, compactChoiceId: string): ResolvedStreams {
  const choices = getCompactChoices(metadata);
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
  const resolved = resolveExpandedStreams(metadata, config);
  return describeResolvedStreams(resolved, config.container);
}

export function describeCompactSelection(metadata: MediaMetadata, compactChoiceId: string) {
  return describeResolvedStreams(resolveCompactStreams(metadata, compactChoiceId));
}

export function describeResolvedStreams(resolved: ResolvedStreams, containerOverride?: string | null) {
  const parts: string[] = [];
  const container =
    containerOverride ??
    resolved.videoFormat?.ext ??
    resolved.audioFormat?.ext ??
    resolved.videoFormat?.container ??
    resolved.audioFormat?.container;

  if (container) {
    parts.push(container.toUpperCase());
  }

  if (resolved.videoFormat) {
    parts.push(getQualityLabel(resolved.videoFormat));
    if (resolved.videoFormat.vcodec && resolved.videoFormat.vcodec !== "none") {
      parts.push(resolved.videoFormat.vcodec.toUpperCase());
    }
  }

  if (resolved.audioFormat) {
    if (!resolved.videoFormat) {
      parts.push(describeAudioLine(resolved.audioFormat));
    }
    if (resolved.audioFormat.acodec && resolved.audioFormat.acodec !== "none") {
      parts.push(resolved.audioFormat.acodec.toUpperCase());
    }
  } else if (resolved.videoFormat?.acodec && resolved.videoFormat.acodec !== "none") {
    parts.push(resolved.videoFormat.acodec.toUpperCase());
  }

  return parts.join(" | ");
}

export function buildVideoFormatLabel(format: MediaFormat) {
  return [
    format.format_id,
    format.height > 0 && format.width > 0 ? `${format.width}x${format.height}` : getQualityLabel(format),
    format.ext.toUpperCase(),
    format.vcodec.toUpperCase(),
    format.fps > 0 ? `${Math.round(format.fps)} fps` : null,
    formatBytes(getApproxSize(format)),
  ]
    .filter(Boolean)
    .join(" | ");
}

export function buildAudioFormatLabel(format: MediaFormat) {
  return [
    format.format_id,
    format.ext.toUpperCase(),
    format.acodec.toUpperCase(),
    format.abr > 0 ? `${Math.round(format.abr)} kbps` : null,
    formatBytes(getApproxSize(format)),
  ]
    .filter(Boolean)
    .join(" | ");
}

function normalizeContainerChoice(
  current: string | null,
  available: string[],
  hasVideoStream: boolean,
  hasAudioStream: boolean,
) {
  if (current && available.includes(current)) {
    return current;
  }

  if (hasVideoStream && available.includes("mp4")) {
    return "mp4";
  }
  if (!hasVideoStream && hasAudioStream && available.includes("m4a")) {
    return "m4a";
  }
  if (!hasVideoStream && hasAudioStream && available.includes("mp3")) {
    return "mp3";
  }

  return available[0] ?? null;
}

function compareCompactChoices(left: CompactChoice, right: CompactChoice) {
  if (left.kind !== right.kind) {
    return left.kind === "video" ? -1 : 1;
  }

  const leftValue = left.preferredFormat.height || left.preferredFormat.abr || 0;
  const rightValue = right.preferredFormat.height || right.preferredFormat.abr || 0;

  return rightValue - leftValue;
}

function compareCompactVideoFormats(left: MediaFormat, right: MediaFormat) {
  const leftPriority = getCompactPriority(left);
  const rightPriority = getCompactPriority(right);
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftArea = (left.width || 0) * (left.height || 0);
  const rightArea = (right.width || 0) * (right.height || 0);
  if (leftArea !== rightArea) {
    return rightArea - leftArea;
  }

  if ((left.fps || 0) !== (right.fps || 0)) {
    return (right.fps || 0) - (left.fps || 0);
  }

  if ((left.vbr || 0) !== (right.vbr || 0)) {
    return (right.vbr || 0) - (left.vbr || 0);
  }

  return getApproxSize(right) - getApproxSize(left);
}

function compareAudioFormats(left: MediaFormat, right: MediaFormat) {
  if ((left.abr || 0) !== (right.abr || 0)) {
    return (right.abr || 0) - (left.abr || 0);
  }

  return getApproxSize(right) - getApproxSize(left);
}

function getCompactPriority(format: MediaFormat) {
  if (isMuxed(format) && format.ext === "mp4") {
    return 0;
  }
  if (isMuxed(format)) {
    return 1;
  }
  if (isVideoOnly(format) && format.ext === "mp4") {
    return 2;
  }
  if (isVideoOnly(format)) {
    return 3;
  }
  return 4;
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

function isKnownContainer(value: string): value is ContainerName {
  return value in CONTAINER_CODEC_RULES;
}
