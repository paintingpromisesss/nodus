import type {
  DownloadRequest,
  FetchMetadataStreamRequest,
  MediaMetadata,
  MetadataStreamEvent,
} from "@/lib/media";

interface StreamMetadataOptions {
  signal?: AbortSignal;
  onEvent: (event: MetadataStreamEvent) => void;
}

export async function fetchHealth() {
  const response = await fetch("/health");
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as { status: string };
}

export async function streamMetadataBatch(
  request: FetchMetadataStreamRequest,
  { signal, onEvent }: StreamMetadataOptions,
) {
  const response = await fetch("/fetch/metadata/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  if (!response.body) {
    throw new Error("The metadata stream closed before any data was returned.");
  }

  await consumeSseStream(response.body, onEvent);
}

export async function downloadMedia(request: DownloadRequest, signal?: AbortSignal) {
  const response = await fetch("/download", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const blob = await response.blob();
  return {
    blob,
    filename: getFilenameFromHeaders(response.headers) ?? "download.bin",
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function consumeSseStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: MetadataStreamEvent) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/g);
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      emitFrame(frame, onEvent);
    }
  }

  const tail = buffer + decoder.decode();
  if (tail.trim()) {
    emitFrame(tail, onEvent);
  }
}

function emitFrame(frame: string, onEvent: (event: MetadataStreamEvent) => void) {
  const parsed = parseSseFrame(frame);
  if (!parsed?.data) {
    return;
  }

  const payload = JSON.parse(parsed.data) as Record<string, unknown>;
  switch (parsed.event) {
    case "ready":
      onEvent({ event: "ready", payload: { total: Number(payload.total) } });
      break;
    case "item":
      onEvent({
        event: "item",
        payload: {
          index: Number(payload.index),
          url: String(payload.url ?? ""),
          data: payload.data as MediaMetadata,
        },
      });
      break;
    case "error":
      onEvent({
        event: "error",
        payload: {
          index: Number(payload.index),
          url: String(payload.url ?? ""),
          error: String(payload.error ?? "Unknown error"),
        },
      });
      break;
    case "fatal":
      onEvent({
        event: "fatal",
        payload: {
          error: String(payload.error ?? "Unknown error"),
        },
      });
      break;
    case "done":
      onEvent({ event: "done", payload: { total: Number(payload.total) } });
      break;
    default:
      break;
  }
}

function parseSseFrame(frame: string) {
  const lines = frame.split(/\r?\n/g);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
}

async function readApiError(response: Response) {
  const text = await response.text();
  if (!text) {
    return `${response.status} ${response.statusText}`.trim();
  }

  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || text;
  } catch {
    return text;
  }
}

function getFilenameFromHeaders(headers: Headers) {
  const contentDisposition = headers.get("content-disposition");
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const simpleMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (simpleMatch?.[1]) {
    return simpleMatch[1];
  }

  return null;
}
