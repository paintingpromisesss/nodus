import { useMemo, useState } from 'react';

type MediaFormat = {
  format_id: string;
  format_note: string;
  filesize: number;
  filesize_approx: number;
  acodec: string;
  vcodec: string;
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

type ResultItem = {
  id: string;
  url: string;
  status: 'loading' | 'ready' | 'error';
  error?: string;
  metadata?: MediaMetadata;
  selectedVideoFormatId: string;
  selectedAudioFormatId: string;
  container: string;
  vcodec: string;
  acodec: string;
  downloading: boolean;
};

const CONTAINER_MAP: Record<string, { video: string[]; audio: string[] }> = {
  mp4: { video: ['h264', 'hevc', 'av1', 'vp9'], audio: ['aac', 'mp3', 'opus'] },
  webm: { video: ['vp9', 'vp8'], audio: ['opus', 'vorbis'] },
  mkv: { video: ['h264', 'hevc', 'av1', 'vp9', 'vp8'], audio: ['aac', 'mp3', 'opus', 'vorbis'] },
};

const splitUrls = (raw: string): string[] =>
  Array.from(new Set(raw.split(/[\s,]+/g).map((item) => item.trim()).filter(Boolean)));

const formatDuration = (seconds: number): string => {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const humanizeCodec = (codec: string): string => {
  if (!codec || codec === 'none') return 'Unknown';
  return codec.toUpperCase();
};

const formatBitrate = (value: number): string => {
  if (!value || Number.isNaN(value)) return 'N/A';
  return `${Math.round(value)} kbps`;
};

const formatSize = (value: number): string => {
  if (!value || Number.isNaN(value)) return 'N/A';
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const formatVideoLabel = (format: MediaFormat): string => {
  const size = format.filesize || format.filesize_approx;
  const dimensions =
    format.width > 0 && format.height > 0
      ? `${format.width}x${format.height}`
      : format.resolution && format.resolution !== 'audio only'
        ? format.resolution
        : 'Unknown';

  return `${dimensions} (${humanizeCodec(format.vcodec)}) | ${formatBitrate(format.vbr)} | ${formatSize(size)}`;
};

const formatAudioLabel = (format: MediaFormat): string => {
  const size = format.filesize || format.filesize_approx;
  return `${humanizeCodec(format.acodec)} | ${formatBitrate(format.abr)} | ${formatSize(size)}`;
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

  const urlCount = useMemo(() => splitUrls(input).length, [input]);

  const updateResult = (id: string, updater: (prev: ResultItem) => ResultItem) => {
    setResults((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  };

  const fetchMetadata = async () => {
    const urls = splitUrls(input);
    if (urls.length === 0) {
      setError('Добавьте минимум один URL.');
      return;
    }

    setError(null);
    setIsFetching(true);

    setResults(
      urls.map((url, index) => ({
        id: `${index}-${url}`,
        url,
        status: 'loading',
        selectedVideoFormatId: '',
        selectedAudioFormatId: '',
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
        body: JSON.stringify({ urls, options: { use_all_clients: useAllClients } }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Ошибка fetch: HTTP ${response.status}`);
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
          const defaultVideo = formats.find((fmt) => fmt.vcodec !== 'none')?.format_id ?? '';
          const defaultAudio = formats.find((fmt) => fmt.acodec !== 'none' && fmt.vcodec === 'none')?.format_id ?? '';

          updateResult(rowId, (item) => ({
            ...item,
            status: 'ready',
            metadata,
            selectedVideoFormatId: defaultVideo,
            selectedAudioFormatId: defaultAudio,
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
    const formatID = [item.selectedVideoFormatId, item.selectedAudioFormatId].filter(Boolean).join('+');
    if (!formatID) {
      setError('Для скачивания нужно выбрать аудио и/или видео формат.');
      return;
    }

    updateResult(item.id, (prev) => ({ ...prev, downloading: true }));

    try {
      const response = await fetch('/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: item.url,
          options: {
            format_id: formatID,
            container: item.container,
            vcodec: item.vcodec,
            acodec: item.acodec,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Download failed with HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const fileNameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const fileName = fileNameMatch?.[1] ?? `${item.metadata?.title ?? 'media'}.${item.container}`;

      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Ошибка скачивания.');
    } finally {
      updateResult(item.id, (prev) => ({ ...prev, downloading: false }));
    }
  };

  return (
    <div className="page">
      <main className="main-card">
        <p className="badge">Nodus Web UI</p>
        <h1>Вставьте ссылки для fetch</h1>
        <p className="subtitle">Разделители: перенос строки, запятая или пробел.</p>

        <textarea
          placeholder="https://example.com/video-1\nhttps://example.com/video-2"
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

        <button className="fetch-btn" onClick={fetchMetadata} disabled={isFetching || urlCount === 0}>
          {isFetching ? 'Fetching…' : 'Fetch'}
        </button>

        {error && <div className="error-banner">{error}</div>}
      </main>

      <section className="results-list">
        {results.map((item) => {
          const formats = item.metadata?.formats ?? [];
          const videoOptions = formats.filter((fmt) => fmt.vcodec !== 'none');
          const audioOptions = formats.filter((fmt) => fmt.acodec !== 'none');

          const allowedContainers = Object.entries(CONTAINER_MAP)
            .filter(([_, codecs]) => {
              const vOk = !item.vcodec || codecs.video.includes(item.vcodec);
              const aOk = !item.acodec || codecs.audio.includes(item.acodec);
              return vOk && aOk;
            })
            .map(([container]) => container);

          const allowedVideoCodecs = item.container
            ? CONTAINER_MAP[item.container].video.filter(
                (codec) => !item.acodec || CONTAINER_MAP[item.container].audio.includes(item.acodec),
              )
            : [];

          const allowedAudioCodecs = item.container
            ? CONTAINER_MAP[item.container].audio.filter(
                (codec) => !item.vcodec || CONTAINER_MAP[item.container].video.includes(item.vcodec),
              )
            : [];

          return (
            <article className="result-card" key={item.id}>
              <div className="thumb-wrap">
                {item.metadata?.thumbnail ? <img src={item.metadata.thumbnail} alt={item.metadata.title} /> : <div>Нет превью</div>}
              </div>

              <div className="result-content">
                <header>
                  <h3>{item.metadata?.title ?? item.url}</h3>
                  <p className="meta-row">
                    URL:{' '}
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.url}
                    </a>
                  </p>
                  <p className="meta-row">Duration: {formatDuration(item.metadata?.duration ?? 0)}</p>
                </header>

                {item.status === 'error' && <p className="error">{item.error}</p>}
                {item.status === 'loading' && <p className="muted">Получаем метаданные…</p>}

                {item.status === 'ready' && (
                  <>
                    <div className="grid">
                      <label>
                        Video format
                        <select
                          value={item.selectedVideoFormatId}
                          onChange={(event) =>
                            updateResult(item.id, (prev) => ({ ...prev, selectedVideoFormatId: event.target.value }))
                          }
                        >
                          <option value="">Без видео</option>
                          {videoOptions.map((format) => (
                            <option key={format.format_id} value={format.format_id}>
                              {formatVideoLabel(format)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Audio format
                        <select
                          value={item.selectedAudioFormatId}
                          onChange={(event) =>
                            updateResult(item.id, (prev) => ({ ...prev, selectedAudioFormatId: event.target.value }))
                          }
                        >
                          <option value="">Без аудио</option>
                          {audioOptions.map((format) => (
                            <option key={format.format_id} value={format.format_id}>
                              {formatAudioLabel(format)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Container
                        <select
                          value={item.container}
                          onChange={(event) => {
                            const nextContainer = event.target.value;
                            updateResult(item.id, (prev) => ({
                              ...prev,
                              container: nextContainer,
                              vcodec: CONTAINER_MAP[nextContainer].video.includes(prev.vcodec)
                                ? prev.vcodec
                                : CONTAINER_MAP[nextContainer].video[0],
                              acodec: CONTAINER_MAP[nextContainer].audio.includes(prev.acodec)
                                ? prev.acodec
                                : CONTAINER_MAP[nextContainer].audio[0],
                            }));
                          }}
                        >
                          {allowedContainers.map((container) => (
                            <option key={container} value={container}>
                              {container}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        VCodec
                        <select
                          value={item.vcodec}
                          onChange={(event) => {
                            const nextVCodec = event.target.value;
                            updateResult(item.id, (prev) => {
                              const nextContainer = Object.keys(CONTAINER_MAP).find(
                                (container) =>
                                  CONTAINER_MAP[container].video.includes(nextVCodec) &&
                                  CONTAINER_MAP[container].audio.includes(prev.acodec),
                              );

                              return {
                                ...prev,
                                vcodec: nextVCodec,
                                container: nextContainer ?? prev.container,
                              };
                            });
                          }}
                        >
                          {allowedVideoCodecs.map((codec) => (
                            <option key={codec} value={codec}>
                              {codec}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        ACodec
                        <select
                          value={item.acodec}
                          onChange={(event) => {
                            const nextACodec = event.target.value;
                            updateResult(item.id, (prev) => {
                              const nextContainer = Object.keys(CONTAINER_MAP).find(
                                (container) =>
                                  CONTAINER_MAP[container].audio.includes(nextACodec) &&
                                  CONTAINER_MAP[container].video.includes(prev.vcodec),
                              );

                              return {
                                ...prev,
                                acodec: nextACodec,
                                container: nextContainer ?? prev.container,
                              };
                            });
                          }}
                        >
                          {allowedAudioCodecs.map((codec) => (
                            <option key={codec} value={codec}>
                              {codec}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <button className="download-btn" onClick={() => downloadItem(item)} disabled={item.downloading}>
                      {item.downloading ? 'Downloading…' : 'Download ⬇'}
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
