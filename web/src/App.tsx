import { useMemo, useState } from 'react';

type Format = {
  format_id: string;
  format_note?: string;
  acodec?: string;
  vcodec?: string;
  ext?: string;
  resolution?: string;
  abr?: number;
  vbr?: number;
};

type MediaMetadata = {
  title: string;
  thumbnail?: string;
  duration?: number;
  original_url: string;
  formats: Format[];
};

type FetchResult = {
  id: string;
  requestUrl: string;
  status: 'waiting' | 'ready' | 'error' | 'downloading';
  error?: string;
  metadata?: MediaMetadata;
  selectedVideoFormatId: string;
  selectedAudioFormatId: string;
  selectedContainer: string;
  selectedVCodec: string;
  selectedACodec: string;
};

const CONTAINER_RULES: Record<string, { video: string[]; audio: string[] }> = {
  mp4: { video: ['h264', 'hevc', 'av1', 'vp9'], audio: ['aac', 'mp3', 'opus'] },
  webm: { video: ['vp9', 'vp8'], audio: ['opus', 'vorbis'] },
  mkv: { video: ['h264', 'hevc', 'av1', 'vp9', 'vp8'], audio: ['aac', 'mp3', 'opus', 'vorbis'] },
};

function parseUrls(value: string): string[] {
  return value
    .split(/[\s,]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds < 1) return '—';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return hrs > 0 ? `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${mins}:${String(secs).padStart(2, '0')}`;
}

function getVideoFormats(formats: Format[]): Format[] {
  return formats.filter((format) => format.vcodec && format.vcodec !== 'none');
}

function getAudioFormats(formats: Format[]): Format[] {
  return formats.filter((format) => format.acodec && format.acodec !== 'none');
}

function buildFormatLabel(format: Format): string {
  const parts = [format.format_id, format.ext, format.resolution, format.format_note, format.vbr ? `${format.vbr}kbps` : '', format.abr ? `${format.abr}kbps` : ''].filter(Boolean);
  return parts.join(' • ');
}

async function streamSSE(response: Response, onEvent: (eventName: string, payload: any) => void): Promise<void> {
  if (!response.body) throw new Error('Response stream is unavailable');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;

    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      const lines = event.split('\n');
      let eventName = 'message';
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }

      if (dataLines.length > 0) {
        onEvent(eventName, JSON.parse(dataLines.join('\n')));
      }
    }
  }
}

export default function App() {
  const [urlsText, setUrlsText] = useState('');
  const [results, setResults] = useState<FetchResult[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [statusText, setStatusText] = useState('Готово к fetch.');

  const summary = useMemo(() => {
    if (results.length === 0) return 'Нет результатов';
    const ready = results.filter((item) => item.status === 'ready').length;
    const error = results.filter((item) => item.status === 'error').length;
    return `Всего: ${results.length} • Готово: ${ready} • Ошибок: ${error}`;
  }, [results]);

  const updateResult = (id: string, patch: Partial<FetchResult>) => {
    setResults((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleFetch = async () => {
    const urls = parseUrls(urlsText);
    if (urls.length === 0) {
      setStatusText('Добавьте хотя бы один URL.');
      return;
    }

    const initial = urls.map((url, index) => ({
      id: `${index}-${url}`,
      requestUrl: url,
      status: 'waiting' as const,
      selectedVideoFormatId: '',
      selectedAudioFormatId: '',
      selectedContainer: '',
      selectedVCodec: 'copy',
      selectedACodec: 'copy',
    }));

    setResults(initial);
    setIsFetching(true);
    setStatusText('Получаем metadata...');

    try {
      const response = await fetch('/fetch/metadata/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ urls, options: { use_all_clients: true } }),
      });

      if (!response.ok) {
        throw new Error(`Fetch failed (${response.status})`);
      }

      await streamSSE(response, (eventName, payload) => {
        if (eventName === 'item') {
          const id = `${payload.index}-${payload.url}`;
          const metadata: MediaMetadata = payload.data;
          const video = getVideoFormats(metadata.formats)[0]?.format_id ?? '';
          const audio = getAudioFormats(metadata.formats)[0]?.format_id ?? '';

          updateResult(id, {
            status: 'ready',
            metadata,
            selectedVideoFormatId: video,
            selectedAudioFormatId: audio,
            selectedContainer: 'mp4',
          });
        }

        if (eventName === 'error') {
          const id = `${payload.index}-${payload.url}`;
          updateResult(id, {
            status: 'error',
            error: payload.error,
          });
        }

        if (eventName === 'done') {
          setStatusText('Fetch завершен.');
          setIsFetching(false);
        }
      });
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Не удалось получить metadata.');
      setIsFetching(false);
    }
  };

  const handleDownload = async (item: FetchResult) => {
    if (!item.metadata) return;

    updateResult(item.id, { status: 'downloading' });

    try {
      const formatId = [item.selectedVideoFormatId, item.selectedAudioFormatId].filter(Boolean).join('+');
      const response = await fetch('/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/octet-stream',
        },
        body: JSON.stringify({
          url: item.metadata.original_url,
          options: {
            format_id: formatId,
            vcodec: item.selectedVCodec === 'copy' ? '' : item.selectedVCodec,
            acodec: item.selectedACodec === 'copy' ? '' : item.selectedACodec,
            container: item.selectedContainer,
          },
        }),
      });

      if (!response.ok) throw new Error(`Download failed (${response.status})`);

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${item.metadata.title || 'download'}.${item.selectedContainer || 'bin'}`;
      a.click();
      URL.revokeObjectURL(href);
      updateResult(item.id, { status: 'ready' });
    } catch (error) {
      updateResult(item.id, { status: 'error', error: error instanceof Error ? error.message : 'Download failed' });
    }
  };

  return (
    <div className="app-shell">
      <main className="main-column">
        <h1 className="headline">Nodus Fetch UI</h1>
        <div className="input-panel">
          <textarea
            value={urlsText}
            onChange={(event) => setUrlsText(event.target.value)}
            placeholder="Вставьте URL (разделители: перенос, запятая, пробел)"
          />
          <button onClick={handleFetch} disabled={isFetching}>
            {isFetching ? 'Fetching…' : 'Fetch'}
          </button>
          <p className="status">{statusText}</p>
        </div>

        <section className="results-panel">
          <div className="results-header">
            <h2>Результаты</h2>
            <span>{summary}</span>
          </div>

          {results.length === 0 && <div className="empty">Здесь появятся карточки после fetch.</div>}

          {results.map((item) => {
            const metadata = item.metadata;
            const formats = metadata?.formats ?? [];
            const videoFormats = getVideoFormats(formats);
            const audioFormats = getAudioFormats(formats);
            const allowedVCodecs = item.selectedContainer ? CONTAINER_RULES[item.selectedContainer].video : [];
            const allowedACodecs = item.selectedContainer ? CONTAINER_RULES[item.selectedContainer].audio : [];

            return (
              <article key={item.id} className="card">
                <div className="thumb-wrap">
                  {metadata?.thumbnail ? <img src={metadata.thumbnail} alt={metadata.title} /> : <div className="thumb-placeholder">No preview</div>}
                </div>

                <div className="card-body">
                  <h3>{metadata?.title ?? 'Ожидание metadata...'}</h3>
                  <a href={item.requestUrl} target="_blank" rel="noreferrer">
                    {item.requestUrl}
                  </a>
                  <div className="meta">Duration: {formatDuration(metadata?.duration)}</div>
                  {item.error && <div className="error">{item.error}</div>}

                  <div className="selectors">
                    <select
                      value={item.selectedVideoFormatId}
                      onChange={(event) => updateResult(item.id, { selectedVideoFormatId: event.target.value })}
                      disabled={!metadata}
                    >
                      <option value="">Video format</option>
                      {videoFormats.map((format) => (
                        <option key={format.format_id} value={format.format_id}>
                          {buildFormatLabel(format)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={item.selectedAudioFormatId}
                      onChange={(event) => updateResult(item.id, { selectedAudioFormatId: event.target.value })}
                      disabled={!metadata}
                    >
                      <option value="">Audio format</option>
                      {audioFormats.map((format) => (
                        <option key={format.format_id} value={format.format_id}>
                          {buildFormatLabel(format)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={item.selectedContainer}
                      onChange={(event) => {
                        const container = event.target.value;
                        const nextV = CONTAINER_RULES[container]?.video.includes(item.selectedVCodec) ? item.selectedVCodec : 'copy';
                        const nextA = CONTAINER_RULES[container]?.audio.includes(item.selectedACodec) ? item.selectedACodec : 'copy';
                        updateResult(item.id, { selectedContainer: container, selectedVCodec: nextV, selectedACodec: nextA });
                      }}
                      disabled={!metadata}
                    >
                      <option value="">Container</option>
                      {Object.keys(CONTAINER_RULES).map((container) => (
                        <option key={container} value={container}>
                          {container}
                        </option>
                      ))}
                    </select>

                    <select
                      value={item.selectedVCodec}
                      onChange={(event) => updateResult(item.id, { selectedVCodec: event.target.value })}
                      disabled={!metadata || !item.selectedContainer}
                    >
                      <option value="copy">vcodec: copy</option>
                      {allowedVCodecs.map((codec) => (
                        <option key={codec} value={codec}>
                          {codec}
                        </option>
                      ))}
                    </select>

                    <select
                      value={item.selectedACodec}
                      onChange={(event) => updateResult(item.id, { selectedACodec: event.target.value })}
                      disabled={!metadata || !item.selectedContainer}
                    >
                      <option value="copy">acodec: copy</option>
                      {allowedACodecs.map((codec) => (
                        <option key={codec} value={codec}>
                          {codec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button className="download" disabled={!metadata || item.status === 'downloading'} onClick={() => void handleDownload(item)}>
                    {item.status === 'downloading' ? 'Downloading…' : '⬇ Download'}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
