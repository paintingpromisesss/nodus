import { useMemo, useState } from 'react';

type MediaFormat = {
  format_id: string;
  format_note: string;
  filesize: number;
  filesize_approx: number;
  acodec: string;
  vcodec: string;
  audio_ext: string;
  video_ext: string;
  ext: string;
  width: number;
  height: number;
  resolution: string;
  abr: number;
  vbr: number;
  fps: number;
};

type MediaMetadata = {
  id: string;
  title: string;
  thumbnail: string;
  original_url: string;
  duration: number;
  formats: MediaFormat[];
};

type SourceMode = 'muxed' | 'separate';

type ResultItem = {
  id: string;
  url: string;
  status: 'loading' | 'ready' | 'error';
  error?: string;
  metadata?: MediaMetadata;
  enableVideo: boolean;
  enableAudio: boolean;
  sourceMode: SourceMode;
  selectedMuxedFormatId: string;
  selectedVideoFormatId: string;
  selectedAudioFormatId: string;
  enableFfmpeg: boolean;
  container: string;
  vcodec: string;
  acodec: string;
  downloading: boolean;
};

type DownloadOptionsPayload = {
  container?: string;
  vcodec?: string;
  acodec?: string;
};

type DownloadRequestPayload = {
  url: string;
  format_id: string;
  options?: {
    container?: string;
    vcodec?: string;
    acodec?: string;
  };
};

const CONTAINER_MAP: Record<string, { video: string[]; audio: string[] }> = {
  mp4: { video: ['h264', 'hevc', 'av1', 'vp9'], audio: ['aac', 'alac', 'flac', 'mp3', 'opus'] },
  mov: {
    video: ['h264', 'hevc'],
    audio: ['aac', 'alac', 'mp3', 'pcm_s16le', 'pcm_s24le', 'pcm_f32le'],
  },
  m4a: { video: [], audio: ['aac', 'alac', 'mp3'] },
  webm: { video: ['vp9', 'vp8', 'av1'], audio: ['opus', 'vorbis'] },
  ogg: { video: [], audio: ['opus', 'vorbis', 'flac'] },
  opus: { video: [], audio: ['opus'] },
  mp3: { video: [], audio: ['mp3'] },
  flac: { video: [], audio: ['flac'] },
  wav: { video: [], audio: ['pcm_s16le', 'pcm_s24le', 'pcm_f32le'] },
  mkv: {
    video: ['h264', 'hevc', 'av1', 'vp9', 'vp8'],
    audio: ['aac', 'alac', 'flac', 'mp3', 'opus', 'pcm_s16le', 'pcm_s24le', 'pcm_f32le', 'vorbis'],
  },
};

const NO_CONTAINER = '';
const NO_VIDEO_CODEC = 'none';
const NO_AUDIO_CODEC = 'none';

const CODEC_ALIASES: Record<string, string> = {
  avc1: 'h264',
  avc3: 'h264',
  h264: 'h264',
  hev1: 'hevc',
  hvc1: 'hevc',
  hevc: 'hevc',
  av01: 'av1',
  av1: 'av1',
  vp09: 'vp9',
  vp9: 'vp9',
  vp08: 'vp8',
  vp8: 'vp8',
  mp4a: 'aac',
  aac: 'aac',
  alac: 'alac',
  flac: 'flac',
  mp3: 'mp3',
  opus: 'opus',
  pcm_s16le: 'pcm_s16le',
  pcm_s24le: 'pcm_s24le',
  pcm_f32le: 'pcm_f32le',
  vorbis: 'vorbis',
};

const splitUrls = (raw: string): string[] =>
  Array.from(new Set(raw.split(/[\s,]+/g).map((item) => item.trim()).filter(Boolean)));

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeInputUrl = (value: string): string | null => {
  if (isHttpUrl(value)) {
    const parsed = new URL(value);
    const hostname = parsed.hostname.trim();
    const isIpv4Address = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
    const isIpv6Address = hostname.includes(':');
    const hasDomainLikeHostname = hostname.includes('.');

    return !isIpv4Address && !isIpv6Address && hostname !== 'localhost' && hasDomainLikeHostname
      ? value
      : null;
  }

  const withHttps = `https://${value}`;
  if (!isHttpUrl(withHttps)) {
    return null;
  }

  const parsed = new URL(withHttps);
  const hostname = parsed.hostname.trim();
  const isIpv4Address = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const isIpv6Address = hostname.includes(':');
  const hasDomainLikeHostname = hostname.includes('.');

  return !isIpv4Address && !isIpv6Address && hostname !== 'localhost' && hasDomainLikeHostname
    ? withHttps
    : null;
};

const sanitizeDownloadFilename = (value: string): string =>
  value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

const parseDownloadFilename = (disposition: string, fallback: string): string => {
  const encodedMatch = disposition.match(/filename\*\s*=\s*([^;]+)/i);
  const encodedValue = encodedMatch?.[1]?.trim().replace(/^"(.*)"$/, '$1');
  if (encodedValue) {
    const normalized = encodedValue.replace(/^UTF-8''/i, '');
    try {
      return decodeURIComponent(normalized);
    } catch {
      return normalized;
    }
  }

  const plainMatch = disposition.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
  const plainValue = plainMatch?.[1] ?? plainMatch?.[2];
  return plainValue?.trim() || fallback;
};

const buildPreferredDownloadFilename = (item: ResultItem, disposition: string): string => {
  const title = sanitizeDownloadFilename(item.metadata?.title ?? '');
  const extension = sanitizeDownloadFilename(item.container || '').toLowerCase();

  if (title && extension) {
    return `${title}.${extension}`;
  }

  if (title) {
    return title;
  }

  return parseDownloadFilename(disposition, `${item.metadata?.title ?? 'media'}.${item.container}`);
};

const formatDuration = (seconds: number): string => {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const humanizeCodec = (codec: string): string => {
  if (!codec || codec === 'none') return 'Unknown';
  const normalized = normalizeCodec(codec);

  const labels: Record<string, string> = {
    h264: 'H.264',
    hevc: 'H.265 / HEVC',
    av1: 'AV1',
    vp9: 'VP9',
    vp8: 'VP8',
    aac: 'AAC',
    alac: 'ALAC',
    flac: 'FLAC',
    mp3: 'MP3',
    opus: 'Opus',
    vorbis: 'Vorbis',
    pcm_s16le: 'PCM 16-bit',
    pcm_s24le: 'PCM 24-bit',
    pcm_f32le: 'PCM Float 32-bit',
  };

  if (normalized && labels[normalized]) {
    return labels[normalized];
  }

  return codec.toUpperCase();
};

const normalizeCodec = (codec: string): string => {
  if (!codec || codec === 'none') return '';

  const lowered = codec.toLowerCase();
  const matchedAlias = Object.entries(CODEC_ALIASES).find(([alias]) => lowered === alias || lowered.startsWith(`${alias}.`));
  return matchedAlias?.[1] ?? lowered;
};

const formatBitrate = (value: number): string => {
  if (!value || Number.isNaN(value)) return 'N/A';
  return `${Math.round(value)} kbps`;
};

const formatSize = (value: number): string => {
  if (!value || Number.isNaN(value)) return 'N/A';
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const joinKnownLabelParts = (parts: Array<string | null | undefined>, fallback: string): string => {
  const filtered = parts.map((part) => part?.trim() ?? '').filter(Boolean);
  return filtered.length > 0 ? filtered.join(' | ') : fallback;
};

const formatVideoLabel = (format: MediaFormat): string => {
  const size = format.filesize || format.filesize_approx;
  const dimensions =
    format.width > 0 && format.height > 0
      ? `${format.width}x${format.height}`
      : format.resolution && format.resolution !== 'audio only'
        ? format.resolution
        : '';
  const codec = humanizeCodec(format.vcodec);
  const title = dimensions
    ? codec !== 'Unknown'
      ? `${dimensions} (${codec})`
      : dimensions
    : codec !== 'Unknown'
      ? codec
      : '';

  return joinKnownLabelParts(
    [title, formatBitrate(format.vbr) !== 'N/A' ? formatBitrate(format.vbr) : '', formatSize(size) !== 'N/A' ? formatSize(size) : ''],
    format.format_id,
  );
};

const formatAudioLabel = (format: MediaFormat): string => {
  const size = format.filesize || format.filesize_approx;
  const codec = humanizeCodec(format.acodec);

  return joinKnownLabelParts(
    [codec !== 'Unknown' ? codec : '', formatBitrate(format.abr) !== 'N/A' ? formatBitrate(format.abr) : '', formatSize(size) !== 'N/A' ? formatSize(size) : ''],
    format.format_id,
  );
};

const hasVideoStream = (format?: MediaFormat): boolean => {
  if (!format) return false;
  if (format.vcodec === 'none') return false;
  if (format.vcodec) return true;
  return Boolean(format.video_ext && format.video_ext !== 'none');
};

const hasAudioStream = (format?: MediaFormat): boolean => {
  if (!format) return false;
  if (format.acodec === 'none') return false;
  if (format.acodec) return true;
  return Boolean(format.audio_ext && format.audio_ext !== 'none');
};

const isMuxedFormat = (format: MediaFormat): boolean => hasVideoStream(format) && hasAudioStream(format);

const isSeparateVideoFormat = (format: MediaFormat): boolean => hasVideoStream(format) && !hasAudioStream(format);

const isSeparateAudioFormat = (format: MediaFormat): boolean => hasAudioStream(format) && !hasVideoStream(format);

const getFormatGroups = (formats: MediaFormat[]) => ({
  muxed: formats.filter(isMuxedFormat),
  separateVideo: formats.filter(isSeparateVideoFormat),
  separateAudio: formats.filter(isSeparateAudioFormat),
});

const buildDownloadRequestPayload = (
  url: string,
  formatID: string,
  options?: DownloadOptionsPayload,
): DownloadRequestPayload => {
  const normalizedOptions = {
    container: options?.container?.trim() || undefined,
    vcodec: options?.vcodec?.trim() || undefined,
    acodec: options?.acodec?.trim() || undefined,
  };

  const hasOptions = Object.values(normalizedOptions).some(Boolean);

  return {
    url,
    format_id: formatID,
    ...(hasOptions ? { options: normalizedOptions } : {}),
  };
};

const findFormatById = (formats: MediaFormat[], formatId: string): MediaFormat | undefined =>
  formats.find((format) => format.format_id === formatId);

const getAllSupportedVideoCodecs = (): string[] =>
  Array.from(new Set(Object.values(CONTAINER_MAP).flatMap((config) => config.video)));

const getAllSupportedAudioCodecs = (): string[] =>
  Array.from(new Set(Object.values(CONTAINER_MAP).flatMap((config) => config.audio)));

const containerSupportsSelection = (
  container: string,
  videoCodec?: string,
  audioCodec?: string,
): boolean => {
  const config = CONTAINER_MAP[container];
  if (!config) return false;

  const normalizedVideoCodec = normalizeCodec(videoCodec ?? '');
  const normalizedAudioCodec = normalizeCodec(audioCodec ?? '');

  const videoOk =
    !normalizedVideoCodec || normalizedVideoCodec === NO_VIDEO_CODEC || config.video.includes(normalizedVideoCodec);
  const audioOk =
    !normalizedAudioCodec || normalizedAudioCodec === NO_AUDIO_CODEC || config.audio.includes(normalizedAudioCodec);
  return videoOk && audioOk;
};

const getAllowedContainers = (videoCodec?: string, audioCodec?: string): string[] => {
  const normalizedVideoCodec = normalizeCodec(videoCodec ?? '');
  const normalizedAudioCodec = normalizeCodec(audioCodec ?? '');
  const isAudioOnly = !normalizedVideoCodec && Boolean(normalizedAudioCodec);

  return Object.keys(CONTAINER_MAP).filter((container) => {
    if (isAudioOnly && container === 'mp4') {
      return false;
    }

    return containerSupportsSelection(container, normalizedVideoCodec, normalizedAudioCodec);
  });
};

const getAllowedVideoCodecs = (container: string, audioCodec?: string): string[] => {
  if (!container || !(container in CONTAINER_MAP)) {
    return [];
  }

  const normalizedAudioCodec = normalizeCodec(audioCodec ?? '');
  return CONTAINER_MAP[container].video.filter(
    () =>
      !normalizedAudioCodec ||
      normalizedAudioCodec === NO_AUDIO_CODEC ||
      CONTAINER_MAP[container].audio.includes(normalizedAudioCodec),
  );
};

const getAllowedAudioCodecs = (container: string, videoCodec?: string): string[] => {
  if (!container || !(container in CONTAINER_MAP)) {
    return [];
  }

  const normalizedVideoCodec = normalizeCodec(videoCodec ?? '');
  return CONTAINER_MAP[container].audio.filter(
    () =>
      !normalizedVideoCodec ||
      normalizedVideoCodec === NO_VIDEO_CODEC ||
      CONTAINER_MAP[container].video.includes(normalizedVideoCodec),
  );
};

const deriveDefaultContainer = (
  videoFormat?: MediaFormat,
  audioFormat?: MediaFormat,
  preferredContainer?: string,
): string => {
  const normalizedVideoCodec = normalizeCodec(videoFormat?.vcodec ?? '');
  const normalizedAudioCodec = normalizeCodec(audioFormat?.acodec ?? '');
  const preferred = Array.from(
    new Set([preferredContainer, videoFormat?.ext, audioFormat?.ext, ...Object.keys(CONTAINER_MAP)].filter(Boolean) as string[]),
  );

  return (
    preferred.find((container) => containerSupportsSelection(container, normalizedVideoCodec, normalizedAudioCodec)) ??
    getAllowedContainers(normalizedVideoCodec, normalizedAudioCodec)[0] ??
    'mp4'
  );
};

const deriveDefaultCodec = (
  sourceCodec: string,
  supportedCodecs: string[],
): string => {
  const normalized = normalizeCodec(sourceCodec);
  if (normalized && supportedCodecs.includes(normalized)) {
    return normalized;
  }

  return supportedCodecs[0] ?? '';
};

const deriveConversionDefaults = (videoFormat?: MediaFormat, audioFormat?: MediaFormat) => {
  const container = deriveDefaultContainer(videoFormat, audioFormat);
  const config = CONTAINER_MAP[container];

  return {
    container,
    vcodec: videoFormat ? deriveDefaultCodec(videoFormat.vcodec ?? '', config.video) : NO_VIDEO_CODEC,
    acodec: audioFormat ? deriveDefaultCodec(audioFormat.acodec ?? '', config.audio) : NO_AUDIO_CODEC,
  };
};

type ResolveConversionSelectionParams = {
  videoFormat?: MediaFormat;
  audioFormat?: MediaFormat;
  preferredContainer?: string;
  preferredVCodec?: string;
  preferredACodec?: string;
  resetVCodecToDefault?: boolean;
  resetACodecToDefault?: boolean;
};

const resolveConversionSelection = ({
  videoFormat,
  audioFormat,
  preferredContainer,
  preferredVCodec,
  preferredACodec,
  resetVCodecToDefault = false,
  resetACodecToDefault = false,
}: ResolveConversionSelectionParams) => {
  if (!videoFormat && !audioFormat) {
    return {
      container: NO_CONTAINER,
      vcodec: NO_VIDEO_CODEC,
      acodec: NO_AUDIO_CODEC,
    };
  }

  const globalVideoCodecs = getAllSupportedVideoCodecs();
  const globalAudioCodecs = getAllSupportedAudioCodecs();

  const defaultVCodec = videoFormat
    ? deriveDefaultCodec(videoFormat.vcodec ?? '', globalVideoCodecs)
    : NO_VIDEO_CODEC;
  const defaultACodec = audioFormat
    ? deriveDefaultCodec(audioFormat.acodec ?? '', globalAudioCodecs)
    : NO_AUDIO_CODEC;

  let vcodec = videoFormat
    ? normalizeCodec(resetVCodecToDefault ? defaultVCodec : preferredVCodec ?? defaultVCodec) || defaultVCodec
    : NO_VIDEO_CODEC;
  let acodec = audioFormat
    ? normalizeCodec(resetACodecToDefault ? defaultACodec : preferredACodec ?? defaultACodec) || defaultACodec
    : NO_AUDIO_CODEC;

  if (videoFormat && !globalVideoCodecs.includes(vcodec)) {
    vcodec = defaultVCodec;
  }
  if (audioFormat && !globalAudioCodecs.includes(acodec)) {
    acodec = defaultACodec;
  }

  let allowedContainers = getAllowedContainers(
    videoFormat ? vcodec : NO_VIDEO_CODEC,
    audioFormat ? acodec : NO_AUDIO_CODEC,
  );

  if (allowedContainers.length === 0) {
    vcodec = defaultVCodec;
    acodec = defaultACodec;
    allowedContainers = getAllowedContainers(
      videoFormat ? vcodec : NO_VIDEO_CODEC,
      audioFormat ? acodec : NO_AUDIO_CODEC,
    );
  }

  const container =
    allowedContainers.find((candidate) => candidate === preferredContainer) ??
    deriveDefaultContainer(videoFormat, audioFormat, preferredContainer);

  const allowedVideoCodecs = videoFormat
    ? getAllowedVideoCodecs(container, audioFormat ? acodec : NO_AUDIO_CODEC)
    : [];
  const allowedAudioCodecs = audioFormat
    ? getAllowedAudioCodecs(container, videoFormat ? vcodec : NO_VIDEO_CODEC)
    : [];

  if (videoFormat && !allowedVideoCodecs.includes(vcodec)) {
    vcodec = deriveDefaultCodec(videoFormat.vcodec ?? '', allowedVideoCodecs);
  }
  if (audioFormat && !allowedAudioCodecs.includes(acodec)) {
    acodec = deriveDefaultCodec(audioFormat.acodec ?? '', allowedAudioCodecs);
  }

  return {
    container,
    vcodec: videoFormat ? vcodec : NO_VIDEO_CODEC,
    acodec: audioFormat ? acodec : NO_AUDIO_CODEC,
  };
};

const buildInitialFormatSelection = (formats: MediaFormat[]) => {
  const { muxed, separateVideo, separateAudio } = getFormatGroups(formats);
  const hasMuxedMode = muxed.length > 0;
  const hasSeparateMode = separateVideo.length > 0 && separateAudio.length > 0;
  const sourceMode: SourceMode = hasSeparateMode ? 'separate' : 'muxed';
  const selectedMuxedFormatId = muxed[0]?.format_id ?? '';
  const selectedVideoFormatId = separateVideo[0]?.format_id ?? '';
  const selectedAudioFormatId = separateAudio[0]?.format_id ?? '';

  const activeVideoFormat =
    sourceMode === 'muxed'
      ? findFormatById(formats, selectedMuxedFormatId)
      : findFormatById(formats, selectedVideoFormatId);
  const activeAudioFormat =
    sourceMode === 'muxed'
      ? findFormatById(formats, selectedMuxedFormatId)
      : findFormatById(formats, selectedAudioFormatId);
  const defaultSettings = resolveConversionSelection({
    videoFormat: activeVideoFormat,
    audioFormat: activeAudioFormat,
  });

  return {
    sourceMode,
    selectedMuxedFormatId,
    selectedVideoFormatId,
    selectedAudioFormatId,
    hasMuxedMode,
    hasSeparateMode,
    defaultSettings,
  };
};

const parseSSEChunk = (
  chunk: string,
  onEvent: (event: string, payload: unknown) => void,
): string => {
  const blocks = chunk.split('\n\n');
  const rest = blocks.pop() ?? '';

  for (const block of blocks) {
    const lines = block.split('\n');
    const eventLine = lines.find((line) => line.startsWith('event:'));
    const dataLine = lines.find((line) => line.startsWith('data:'));
    if (!eventLine || !dataLine) continue;

    const event = eventLine.replace('event:', '').trim();
    const data = dataLine.replace('data:', '').trim();

    try {
      onEvent(event, JSON.parse(data));
    } catch {
      // ignore malformed event
    }
  }

  return rest;
};

export function App() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [useAllClients, setUseAllClients] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urls = useMemo(() => splitUrls(input), [input]);
  const normalizedUrls = useMemo(
    () => urls.map((url) => ({ original: url, normalized: normalizeInputUrl(url) })),
    [urls],
  );
  const invalidUrls = useMemo(
    () => normalizedUrls.filter((item) => !item.normalized).map((item) => item.original),
    [normalizedUrls],
  );
  const urlCount = urls.length;
  const inputValidationError = useMemo(() => {
    if (invalidUrls.length === 0) {
      return null;
    }

    const preview = invalidUrls.slice(0, 3).join(', ');
    const suffix = invalidUrls.length > 3 ? ` and ${invalidUrls.length - 3} more` : '';
    return `Invalid URL format: ${preview}${suffix}. Use a full link or a domain/path like youtube.com/watch?v=...`;
  }, [invalidUrls]);

  const updateResult = (id: string, updater: (prev: ResultItem) => ResultItem) => {
    setResults((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  };

  const fetchMetadata = async () => {
    if (urls.length === 0) {
      setError('Add at least one URL.');
      return;
    }

    if (inputValidationError) {
      setError(inputValidationError);
      return;
    }

    setError(null);
    setIsFetching(true);

    setResults(
      normalizedUrls.map((entry, index) => ({
        id: `${index}-${entry.normalized ?? entry.original}`,
        url: entry.normalized ?? entry.original,
        status: 'loading',
        enableVideo: false,
        enableAudio: false,
        sourceMode: 'separate',
        selectedMuxedFormatId: '',
        selectedVideoFormatId: '',
        selectedAudioFormatId: '',
        enableFfmpeg: false,
        container: 'mp4',
        vcodec: 'h264',
        acodec: 'aac',
        downloading: false,
      })),
    );

    try {
      const response = await fetch('/fetch/metadata/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: normalizedUrls.map((entry) => entry.normalized ?? entry.original),
          options: { use_all_clients: useAllClients },
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Fetch failed: HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseSSEChunk(buffer, (event, payload) => {
          if (event !== 'item' && event !== 'error') return;

          const typed = payload as { index: number; url: string; error?: string; data?: MediaMetadata };
          const rowId = `${typed.index}-${typed.url}`;

          if (event === 'error' || typed.error) {
            updateResult(rowId, (item) => ({ ...item, status: 'error', error: typed.error ?? 'Unknown error' }));
            return;
          }

          const metadata = typed.data;
          const formats = metadata?.formats ?? [];
          const initialSelection = buildInitialFormatSelection(formats);

          updateResult(rowId, (item) => ({
            ...item,
            status: 'ready',
            metadata,
            enableVideo: initialSelection.hasSeparateMode,
            enableAudio: initialSelection.hasSeparateMode,
            sourceMode: initialSelection.sourceMode,
            selectedMuxedFormatId: initialSelection.selectedMuxedFormatId,
            selectedVideoFormatId: initialSelection.selectedVideoFormatId,
            selectedAudioFormatId: initialSelection.selectedAudioFormatId,
            container: initialSelection.defaultSettings.container,
            vcodec: initialSelection.defaultSettings.vcodec,
            acodec: initialSelection.defaultSettings.acodec,
          }));
        });
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unknown error');
    } finally {
      setIsFetching(false);
    }
  };

  const downloadItem = async (item: ResultItem) => {
    const formatID =
      item.sourceMode === 'muxed'
        ? item.selectedMuxedFormatId
        : [item.enableVideo ? item.selectedVideoFormatId : '', item.enableAudio ? item.selectedAudioFormatId : '']
            .filter(Boolean)
            .join('+');

    if (!formatID) {
      setError('Choose at least one enabled video or audio format before downloading.');
      return;
    }

    updateResult(item.id, (prev) => ({ ...prev, downloading: true }));

    try {
      const response = await fetch('/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildDownloadRequestPayload(
            item.url,
            formatID,
            item.enableFfmpeg
              ? {
                  container: item.container,
                  vcodec: item.vcodec,
                  acodec: item.acodec,
                }
              : undefined,
          ),
        ),
      });

      if (!response.ok) {
        throw new Error(`Download failed with HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const fileName = buildPreferredDownloadFilename(item, disposition);

      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Download failed.');
    } finally {
      updateResult(item.id, (prev) => ({ ...prev, downloading: false }));
    }
  };

  return (
    <div className="page">
      <main className="main-card">
        <p className="badge">Nodus Web UI</p>
        <h1>Paste links to fetch metadata</h1>
        <p className="subtitle">Separators: newline, comma, or space.</p>

        <textarea
          placeholder={"https://example.com/video-1\nhttps://example.com/video-2\n..."}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isFetching}
        />

        <div className="controls-row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={useAllClients}
              onChange={(event) => setUseAllClients(event.target.checked)}
            />
            Use all clients
          </label>
          <span>{urlCount} URL(s)</span>
        </div>

        <button
          className="fetch-btn"
          onClick={fetchMetadata}
          disabled={isFetching || urlCount === 0 || invalidUrls.length > 0}
        >
          {isFetching ? 'Fetching...' : 'Fetch'}
        </button>

        {(inputValidationError || error) && <div className="error-banner">{inputValidationError ?? error}</div>}
      </main>

      <section className="results-list">
        {results.map((item) => {
          const formats = item.metadata?.formats ?? [];
          const { muxed: muxedOptions, separateVideo: videoOptions, separateAudio: audioOptions } = getFormatGroups(formats);
          const hasMuxedMode = muxedOptions.length > 0;
          const hasSeparateMode = videoOptions.length > 0 && audioOptions.length > 0;
          const modeToggleDisabled = !hasMuxedMode || !hasSeparateMode;
          const selectedMuxedFormat = findFormatById(formats, item.selectedMuxedFormatId);
          const selectedVideoFormat = findFormatById(formats, item.selectedVideoFormatId);
          const selectedAudioFormat = findFormatById(formats, item.selectedAudioFormatId);
          const activeVideoFormat = item.sourceMode === 'muxed' ? selectedMuxedFormat : item.enableVideo ? selectedVideoFormat : undefined;
          const activeAudioFormat = item.sourceMode === 'muxed' ? selectedMuxedFormat : item.enableAudio ? selectedAudioFormat : undefined;
          const defaultConversion = deriveConversionDefaults(
            activeVideoFormat,
            activeAudioFormat,
          );
          const hasContent = item.sourceMode === 'muxed' ? Boolean(selectedMuxedFormat) : item.enableVideo || item.enableAudio;
          const allowedContainers = hasContent
            ? getAllowedContainers(
                activeVideoFormat ? item.vcodec : NO_VIDEO_CODEC,
                activeAudioFormat ? item.acodec : NO_AUDIO_CODEC,
              )
            : [];
          const allowedVideoCodecs =
            activeVideoFormat && item.container
              ? getAllowedVideoCodecs(item.container, activeAudioFormat ? item.acodec : NO_AUDIO_CODEC)
              : [];
          const allowedAudioCodecs =
            activeAudioFormat && item.container
              ? getAllowedAudioCodecs(item.container, activeVideoFormat ? item.vcodec : NO_VIDEO_CODEC)
              : [];

          return (
            <article className="result-card" key={item.id}>
              <div className="result-thumb">
                <div className="thumb-wrap">
                  {item.metadata?.thumbnail ? <img src={item.metadata.thumbnail} alt={item.metadata.title} /> : <div>No preview</div>}
                </div>
              </div>

              <div className="result-summary">
                <header className="result-header">
                  <div>
                    <h3>{item.metadata?.title ?? item.url}</h3>
                    <p className="meta-row">
                      URL:{' '}
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.url}
                      </a>
                    </p>
                    <p className="meta-row">Duration: {formatDuration(item.metadata?.duration ?? 0)}</p>
                  </div>

                  {item.status === 'ready' && (
                    <div className="header-actions">
                      <div className="mode-row">
                        <div className={`mode-toggle${modeToggleDisabled ? ' is-disabled' : ''}`}>
                          <button
                            type="button"
                            className={item.sourceMode === 'muxed' ? 'is-active' : ''}
                            disabled={modeToggleDisabled}
                            onClick={() =>
                              updateResult(item.id, (prev) => {
                                const nextMuxedFormat = findFormatById(formats, prev.selectedMuxedFormatId || muxedOptions[0]?.format_id || '');
                                const nextSelection = resolveConversionSelection({
                                  videoFormat: nextMuxedFormat,
                                  audioFormat: nextMuxedFormat,
                                  preferredContainer: prev.container,
                                  preferredVCodec: prev.vcodec,
                                  preferredACodec: prev.acodec,
                                });

                                return {
                                  ...prev,
                                  sourceMode: 'muxed',
                                  selectedMuxedFormatId: prev.selectedMuxedFormatId || muxedOptions[0]?.format_id || '',
                                  container: nextSelection.container,
                                  vcodec: nextSelection.vcodec,
                                  acodec: nextSelection.acodec,
                                };
                              })
                            }
                          >
                            Muxed
                          </button>
                          <button
                            type="button"
                            className={item.sourceMode === 'separate' ? 'is-active' : ''}
                            disabled={modeToggleDisabled}
                            onClick={() =>
                              updateResult(item.id, (prev) => {
                                const nextVideoFormat = prev.enableVideo
                                  ? findFormatById(formats, prev.selectedVideoFormatId || videoOptions[0]?.format_id || '')
                                  : undefined;
                                const nextAudioFormat = prev.enableAudio
                                  ? findFormatById(formats, prev.selectedAudioFormatId || audioOptions[0]?.format_id || '')
                                  : undefined;
                                const nextSelection = resolveConversionSelection({
                                  videoFormat: nextVideoFormat,
                                  audioFormat: nextAudioFormat,
                                  preferredContainer: prev.container,
                                  preferredVCodec: prev.vcodec,
                                  preferredACodec: prev.acodec,
                                });

                                return {
                                  ...prev,
                                  sourceMode: 'separate',
                                  enableVideo: true,
                                  enableAudio: true,
                                  selectedVideoFormatId: prev.selectedVideoFormatId || videoOptions[0]?.format_id || '',
                                  selectedAudioFormatId: prev.selectedAudioFormatId || audioOptions[0]?.format_id || '',
                                  container: nextSelection.container,
                                  vcodec: nextSelection.vcodec,
                                  acodec: nextSelection.acodec,
                                };
                              })
                            }
                          >
                            Separate
                          </button>
                        </div>
                      </div>

                      <label className="checkbox conversion-checkbox">
                        <input
                          type="checkbox"
                          checked={item.enableFfmpeg}
                          onChange={(event) =>
                            updateResult(item.id, (prev) => ({ ...prev, enableFfmpeg: event.target.checked }))
                          }
                        />
                        Enable FFmpeg conversion
                      </label>
                    </div>
                  )}
                </header>

                {item.status === 'error' && <p className="result-status error">{item.error}</p>}
                {item.status === 'loading' && <p className="result-status muted">Fetching metadata...</p>}

              </div>

              {item.status === 'ready' && (
                <>
                  <div className={`result-controls ${item.sourceMode === 'muxed' ? 'muxed-controls' : 'separate-controls'}`}>
                    {item.sourceMode === 'muxed' ? (
                      <label className="field-source">
                        <span className="field-title">Source</span>
                        <select
                          value={item.selectedMuxedFormatId}
                          onChange={(event) =>
                            updateResult(item.id, (prev) => {
                              const selectedMuxedFormatId = event.target.value;
                              const nextMuxedFormat = findFormatById(formats, selectedMuxedFormatId);
                              const nextSelection = resolveConversionSelection({
                                videoFormat: nextMuxedFormat,
                                audioFormat: nextMuxedFormat,
                                preferredContainer: prev.container,
                                preferredVCodec: prev.vcodec,
                                preferredACodec: prev.acodec,
                                resetVCodecToDefault: true,
                                resetACodecToDefault: true,
                              });

                              return {
                                ...prev,
                                selectedMuxedFormatId,
                                container: nextSelection.container,
                                vcodec: nextSelection.vcodec,
                                acodec: nextSelection.acodec,
                              };
                            })
                          }
                        >
                          {muxedOptions.map((format) => (
                            <option key={format.format_id} value={format.format_id}>
                              {formatVideoLabel(format)} | {humanizeCodec(format.acodec)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <>
                        <label className="field-video">
                          <span className="stream-label">
                            <span>Video</span>
                            <input
                              type="checkbox"
                              checked={item.enableVideo}
                              onChange={(event) =>
                                updateResult(item.id, (prev) => {
                                  const enableVideo = event.target.checked;
                                  const selectedVideoFormatId = enableVideo
                                    ? prev.selectedVideoFormatId || videoOptions[0]?.format_id || ''
                                    : '';
                                  const nextVideoFormat = enableVideo
                                    ? findFormatById(formats, selectedVideoFormatId)
                                    : undefined;
                                  const nextAudioFormat = prev.enableAudio
                                    ? findFormatById(formats, prev.selectedAudioFormatId)
                                    : undefined;
                                  const nextSelection = resolveConversionSelection({
                                    videoFormat: nextVideoFormat,
                                    audioFormat: nextAudioFormat,
                                    preferredContainer: prev.container,
                                    preferredVCodec: enableVideo ? undefined : prev.vcodec,
                                    preferredACodec: prev.enableAudio ? prev.acodec : undefined,
                                    resetVCodecToDefault: enableVideo,
                                  });

                                  return {
                                    ...prev,
                                    enableVideo,
                                    selectedVideoFormatId,
                                    container: nextSelection.container,
                                    vcodec: nextSelection.vcodec,
                                    acodec: nextSelection.acodec,
                                  };
                                })
                              }
                            />
                          </span>
                          <select
                            disabled={!item.enableVideo}
                            value={item.selectedVideoFormatId}
                            onChange={(event) =>
                              updateResult(item.id, (prev) => {
                                const selectedVideoFormatId = event.target.value;
                                const nextVideoFormat = prev.enableVideo
                                  ? findFormatById(formats, selectedVideoFormatId)
                                  : undefined;
                                const nextAudioFormat = prev.enableAudio
                                  ? findFormatById(formats, prev.selectedAudioFormatId)
                                  : undefined;
                                const nextSelection = resolveConversionSelection({
                                  videoFormat: nextVideoFormat,
                                  audioFormat: nextAudioFormat,
                                  preferredContainer: prev.container,
                                  preferredVCodec: prev.vcodec,
                                  preferredACodec: prev.acodec,
                                  resetVCodecToDefault: true,
                                });

                                return {
                                  ...prev,
                                  selectedVideoFormatId,
                                  container: nextSelection.container,
                                  vcodec: nextSelection.vcodec,
                                  acodec: nextSelection.acodec,
                                };
                              })
                            }
                          >
                            {videoOptions.map((format) => (
                              <option key={format.format_id} value={format.format_id}>
                                {formatVideoLabel(format)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field-audio">
                          <span className="stream-label">
                            <span>Audio</span>
                            <input
                              type="checkbox"
                              checked={item.enableAudio}
                              onChange={(event) =>
                                updateResult(item.id, (prev) => {
                                  const enableAudio = event.target.checked;
                                  const selectedAudioFormatId = enableAudio
                                    ? prev.selectedAudioFormatId || audioOptions[0]?.format_id || ''
                                    : '';
                                  const nextVideoFormat = prev.enableVideo
                                    ? findFormatById(formats, prev.selectedVideoFormatId)
                                    : undefined;
                                  const nextAudioFormat = enableAudio
                                    ? findFormatById(formats, selectedAudioFormatId)
                                    : undefined;
                                  const nextSelection = resolveConversionSelection({
                                    videoFormat: nextVideoFormat,
                                    audioFormat: nextAudioFormat,
                                    preferredContainer: prev.container,
                                    preferredVCodec: prev.enableVideo ? prev.vcodec : undefined,
                                    preferredACodec: enableAudio ? undefined : prev.acodec,
                                    resetACodecToDefault: enableAudio,
                                  });

                                  return {
                                    ...prev,
                                    enableAudio,
                                    selectedAudioFormatId,
                                    container: nextSelection.container,
                                    vcodec: nextSelection.vcodec,
                                    acodec: nextSelection.acodec,
                                  };
                                })
                              }
                            />
                          </span>
                          <select
                            disabled={!item.enableAudio}
                            value={item.selectedAudioFormatId}
                            onChange={(event) =>
                              updateResult(item.id, (prev) => {
                                const selectedAudioFormatId = event.target.value;
                                const nextVideoFormat = prev.enableVideo
                                  ? findFormatById(formats, prev.selectedVideoFormatId)
                                  : undefined;
                                const nextAudioFormat = prev.enableAudio
                                  ? findFormatById(formats, selectedAudioFormatId)
                                  : undefined;
                                const nextSelection = resolveConversionSelection({
                                  videoFormat: nextVideoFormat,
                                  audioFormat: nextAudioFormat,
                                  preferredContainer: prev.container,
                                  preferredVCodec: prev.vcodec,
                                  preferredACodec: prev.acodec,
                                  resetACodecToDefault: true,
                                });

                                return {
                                  ...prev,
                                  selectedAudioFormatId,
                                  container: nextSelection.container,
                                  vcodec: nextSelection.vcodec,
                                  acodec: nextSelection.acodec,
                                };
                              })
                            }
                          >
                            {audioOptions.map((format) => (
                              <option key={format.format_id} value={format.format_id}>
                                {formatAudioLabel(format)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}

                    <label className="field-container">
                      <span className="field-title">Container</span>
                      <select
                        disabled={!item.enableFfmpeg || !hasContent}
                        value={item.container}
                        onChange={(event) => {
                            const nextContainer = event.target.value;
                          updateResult(item.id, (prev) => {
                            const nextVideoFormat =
                              prev.sourceMode === 'muxed'
                                ? findFormatById(formats, prev.selectedMuxedFormatId)
                                : prev.enableVideo
                                  ? findFormatById(formats, prev.selectedVideoFormatId)
                                  : undefined;
                            const nextAudioFormat =
                              prev.sourceMode === 'muxed'
                                ? findFormatById(formats, prev.selectedMuxedFormatId)
                                : prev.enableAudio
                                  ? findFormatById(formats, prev.selectedAudioFormatId)
                                  : undefined;
                            const nextSelection = resolveConversionSelection({
                              videoFormat: nextVideoFormat,
                              audioFormat: nextAudioFormat,
                              preferredContainer: nextContainer,
                              preferredVCodec: prev.vcodec,
                              preferredACodec: prev.acodec,
                            });

                            return {
                              ...prev,
                              container: nextSelection.container,
                              vcodec: nextSelection.vcodec,
                              acodec: nextSelection.acodec,
                            };
                          });
                        }}
                      >
                        {!hasContent && <option value={NO_CONTAINER}>No Content</option>}
                        {allowedContainers.map((container) => (
                          <option key={container} value={container}>
                            {container}
                            {container === defaultConversion.container ? ' (Default)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field-vcodec">
                      <span className="field-title">VCodec</span>
                      <select
                        disabled={!item.enableFfmpeg || !activeVideoFormat}
                        value={item.vcodec}
                        onChange={(event) => {
                          const nextVCodec = event.target.value;
                          updateResult(item.id, (prev) => {
                            const nextVideoFormat =
                              prev.sourceMode === 'muxed'
                                ? findFormatById(formats, prev.selectedMuxedFormatId)
                                : prev.enableVideo
                                  ? findFormatById(formats, prev.selectedVideoFormatId)
                                  : undefined;
                            const nextAudioFormat =
                              prev.sourceMode === 'muxed'
                                ? findFormatById(formats, prev.selectedMuxedFormatId)
                                : prev.enableAudio
                                  ? findFormatById(formats, prev.selectedAudioFormatId)
                                  : undefined;
                            const nextSelection = resolveConversionSelection({
                              videoFormat: nextVideoFormat,
                              audioFormat: nextAudioFormat,
                              preferredContainer: prev.container,
                              preferredVCodec: nextVCodec,
                              preferredACodec: prev.acodec,
                            });

                            return {
                              ...prev,
                              container: nextSelection.container,
                              vcodec: nextSelection.vcodec,
                              acodec: nextSelection.acodec,
                            };
                          });
                        }}
                      >
                        {!activeVideoFormat && <option value={NO_VIDEO_CODEC}>No Video</option>}
                        {allowedVideoCodecs.map((codec) => (
                          <option key={codec} value={codec}>
                            {codec}
                            {codec === defaultConversion.vcodec ? ' (Default)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field-acodec">
                      <span className="field-title">ACodec</span>
                      <select
                        disabled={!item.enableFfmpeg || !activeAudioFormat}
                        value={item.acodec}
                        onChange={(event) => {
                          const nextACodec = event.target.value;
                          updateResult(item.id, (prev) => {
                            const nextVideoFormat =
                              prev.sourceMode === 'muxed'
                                ? findFormatById(formats, prev.selectedMuxedFormatId)
                                : prev.enableVideo
                                  ? findFormatById(formats, prev.selectedVideoFormatId)
                                  : undefined;
                            const nextAudioFormat =
                              prev.sourceMode === 'muxed'
                                ? findFormatById(formats, prev.selectedMuxedFormatId)
                                : prev.enableAudio
                                  ? findFormatById(formats, prev.selectedAudioFormatId)
                                  : undefined;
                            const nextSelection = resolveConversionSelection({
                              videoFormat: nextVideoFormat,
                              audioFormat: nextAudioFormat,
                              preferredContainer: prev.container,
                              preferredVCodec: prev.vcodec,
                              preferredACodec: nextACodec,
                            });

                            return {
                              ...prev,
                              container: nextSelection.container,
                              vcodec: nextSelection.vcodec,
                              acodec: nextSelection.acodec,
                            };
                          });
                        }}
                      >
                        {!activeAudioFormat && <option value={NO_AUDIO_CODEC}>No Audio</option>}
                        {allowedAudioCodecs.map((codec) => (
                          <option key={codec} value={codec}>
                            {codec}
                            {codec === defaultConversion.acodec ? ' (Default)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="action-field field-download">
                      <span className="field-title field-label-hidden">Action</span>
                      <button
                        className="download-btn"
                        onClick={() => downloadItem(item)}
                        disabled={item.downloading || !hasContent}
                      >
                        {item.downloading ? 'Downloading...' : 'Download'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
