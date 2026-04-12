import { useMemo, useState } from 'react';

type Format = {
  format_id: string;
  format_note?: string;
  resolution?: string;
  width?: number;
  height?: number;
  vcodec?: string;
  acodec?: string;
  ext?: string;
};

type ItemMeta = {
  title?: string;
  original_url?: string;
  url?: string;
  duration?: number;
  thumbnail?: string;
  formats?: Format[];
};

type Card = {
  id: string;
  url: string;
  status: 'waiting' | 'ready' | 'error';
  error?: string;
  metadata?: ItemMeta;
  formats: Format[];
  selectedVideoFormatId: string;
  selectedAudioFormatId: string;
  container: string;
  vcodec: string;
  acodec: string;
};

const CONTAINER_RULES: Record<string, { video: string[]; audio: string[] }> = {
  mp4: { video: ['h264', 'hevc', 'av1', 'vp9'], audio: ['aac', 'mp3', 'opus'] },
  webm: { video: ['vp9', 'vp8'], audio: ['opus', 'vorbis'] },
  mkv: { video: ['h264', 'hevc', 'av1', 'vp9', 'vp8'], audio: ['aac', 'mp3', 'opus', 'vorbis'] }
};

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, '') ?? '';

const parseUrls = (raw: string) =>
  Array.from(new Set(raw.split(/[\n,\s]+/g).map((v) => v.trim()).filter(Boolean)));

const hasVideo = (f: Format) => !!f.vcodec && f.vcodec !== 'none';
const hasAudio = (f: Format) => !!f.acodec && f.acodec !== 'none';

const fmtDuration = (s?: number) => {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

export default function App() {
  const [rawUrls, setRawUrls] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Ready to fetch metadata.');

  const validUrls = useMemo(() => parseUrls(rawUrls), [rawUrls]);

  const fetchMetadata = async () => {
    if (!validUrls.length) {
      setMessage('Добавьте хотя бы один URL.');
      return;
    }

    setLoading(true);
    setMessage('Fetching metadata...');
    const waiting: Card[] = validUrls.map((url, i) => ({
      id: `${i}-${url}`,
      url,
      status: 'waiting',
      formats: [],
      selectedVideoFormatId: '',
      selectedAudioFormatId: '',
      container: '',
      vcodec: 'copy',
      acodec: 'copy'
    }));
    setCards(waiting);

    try {
      const res = await fetch(`${API_BASE}/fetch/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: validUrls })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const payload = await res.json();
      const items: Array<ItemMeta & { error?: string }> = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];

      setCards(
        validUrls.map((url, idx) => {
          const item = items[idx] || {};
          const formats = Array.isArray(item.formats) ? item.formats : [];
          const video = formats.filter(hasVideo);
          const audio = formats.filter(hasAudio);
          return {
            id: `${idx}-${url}`,
            url,
            status: item.error ? 'error' : 'ready',
            error: item.error,
            metadata: item,
            formats,
            selectedVideoFormatId: video[0]?.format_id ?? '',
            selectedAudioFormatId: audio[0]?.format_id ?? '',
            container: '',
            vcodec: 'copy',
            acodec: 'copy'
          } as Card;
        })
      );
      setMessage('Fetch complete.');
    } catch (e) {
      setMessage(`Ошибка fetch: ${(e as Error).message}`);
      setCards((prev) => prev.map((c) => ({ ...c, status: 'error', error: c.error || 'Fetch failed' })));
    } finally {
      setLoading(false);
    }
  };

  const updateCard = (id: string, patch: Partial<Card>) => setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const buildCodecOptions = (card: Card) => {
    if (!card.container || !(card.container in CONTAINER_RULES)) {
      return { v: ['copy'], a: ['copy'] };
    }
    return {
      v: ['copy', ...CONTAINER_RULES[card.container].video],
      a: ['copy', ...CONTAINER_RULES[card.container].audio]
    };
  };

  const onContainerChange = (card: Card, container: string) => {
    const rules = CONTAINER_RULES[container];
    const vcodec = rules && card.vcodec !== 'copy' && !rules.video.includes(card.vcodec) ? 'copy' : card.vcodec;
    const acodec = rules && card.acodec !== 'copy' && !rules.audio.includes(card.acodec) ? 'copy' : card.acodec;
    updateCard(card.id, { container, vcodec, acodec });
  };

  const downloadCard = async (card: Card) => {
    try {
      const formatId = [card.selectedVideoFormatId, card.selectedAudioFormatId].filter(Boolean).join('+');
      const res = await fetch(`${API_BASE}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: card.metadata?.original_url || card.url,
          options: {
            format_id: formatId,
            container: card.container,
            vcodec: card.vcodec === 'copy' ? '' : card.vcodec,
            acodec: card.acodec === 'copy' ? '' : card.acodec
          }
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'download.bin';
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      updateCard(card.id, { error: (e as Error).message, status: 'error' });
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <h1>Nodus Fetch UI</h1>
        <p className="subtitle">Вставьте ссылки через перенос строки, запятую или пробел.</p>
        <textarea
          value={rawUrls}
          onChange={(e) => setRawUrls(e.target.value)}
          placeholder="https://example.com/1, https://example.com/2"
        />
        <button className="fetch" onClick={fetchMetadata} disabled={loading}>{loading ? 'Fetching…' : 'Fetch'}</button>
        <div className="message">{message}</div>
      </section>

      <section className="results">
        {!cards.length ? <div className="empty">Нет результатов.</div> : cards.map((card) => {
          const videoOptions = card.formats.filter(hasVideo);
          const audioOptions = card.formats.filter(hasAudio);
          const codecs = buildCodecOptions(card);

          return (
            <article key={card.id} className={`card ${card.status}`}>
              <div className="thumbWrap">
                {card.metadata?.thumbnail ? <img src={card.metadata.thumbnail} className="thumb" alt="preview" /> : <div className="thumbPlaceholder">No preview</div>}
              </div>
              <div className="body">
                <div className="title">{card.metadata?.title || 'Untitled'}</div>
                <div className="meta">URL: {card.metadata?.original_url || card.url}</div>
                <div className="meta">Duration: {fmtDuration(card.metadata?.duration)}</div>

                <div className="grid">
                  <label>Video format
                    <select value={card.selectedVideoFormatId} onChange={(e) => updateCard(card.id, { selectedVideoFormatId: e.target.value })}>
                      <option value="">—</option>
                      {videoOptions.map((f) => <option key={f.format_id} value={f.format_id}>{f.format_id} {f.resolution || ''}</option>)}
                    </select>
                  </label>
                  <label>Audio format
                    <select value={card.selectedAudioFormatId} onChange={(e) => updateCard(card.id, { selectedAudioFormatId: e.target.value })}>
                      <option value="">—</option>
                      {audioOptions.map((f) => <option key={f.format_id} value={f.format_id}>{f.format_id}</option>)}
                    </select>
                  </label>
                  <label>Container
                    <select value={card.container} onChange={(e) => onContainerChange(card, e.target.value)}>
                      <option value="">Original</option>
                      {Object.keys(CONTAINER_RULES).map((v) => <option key={v} value={v}>{v.toUpperCase()}</option>)}
                    </select>
                  </label>
                  <label>VCodec
                    <select value={card.vcodec} onChange={(e) => updateCard(card.id, { vcodec: e.target.value })}>
                      {codecs.v.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label>ACodec
                    <select value={card.acodec} onChange={(e) => updateCard(card.id, { acodec: e.target.value })}>
                      {codecs.a.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>

                {card.error ? <div className="error">{card.error}</div> : null}
                <button className="download" onClick={() => downloadCard(card)}>⬇ Download</button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
