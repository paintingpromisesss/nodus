import { describe, expect, it } from "vitest";
import {
  buildCompactDownloadRequest,
  buildExpandedDownloadRequest,
  coerceExpandedConfig,
  normalizeUrlInput,
  type ExpandedConfig,
  type MediaMetadata,
} from "@/lib/media";

const sampleMetadata: MediaMetadata = {
  id: "sample",
  title: "Sample media",
  thumbnail: "https://example.com/thumb.jpg",
  is_live: false,
  media_type: "video",
  original_url: "https://example.com/watch?v=sample",
  duration: 213,
  formats: [
    {
      format_id: "18",
      format_note: "360p",
      filesize: 11_000_000,
      filesize_approx: 0,
      acodec: "aac",
      vcodec: "h264",
      audio_ext: "m4a",
      video_ext: "mp4",
      ext: "mp4",
      container: "mp4_dash",
      width: 640,
      height: 360,
      fps: 30,
      url: "https://example.com/18",
      abr: 128,
      vbr: 800,
      resolution: "640x360",
    },
    {
      format_id: "136",
      format_note: "720p",
      filesize: 50_000_000,
      filesize_approx: 0,
      acodec: "none",
      vcodec: "h264",
      audio_ext: "none",
      video_ext: "mp4",
      ext: "mp4",
      container: "mp4_dash",
      width: 1280,
      height: 720,
      fps: 30,
      url: "https://example.com/136",
      abr: 0,
      vbr: 2_000,
      resolution: "1280x720",
    },
    {
      format_id: "247",
      format_note: "720p",
      filesize: 48_000_000,
      filesize_approx: 0,
      acodec: "none",
      vcodec: "vp9",
      audio_ext: "none",
      video_ext: "webm",
      ext: "webm",
      container: "webm_dash",
      width: 1280,
      height: 720,
      fps: 30,
      url: "https://example.com/247",
      abr: 0,
      vbr: 1_900,
      resolution: "1280x720",
    },
    {
      format_id: "140",
      format_note: "audio",
      filesize: 3_400_000,
      filesize_approx: 0,
      acodec: "aac",
      vcodec: "none",
      audio_ext: "m4a",
      video_ext: "none",
      ext: "m4a",
      container: "m4a_dash",
      width: 0,
      height: 0,
      fps: 0,
      url: "https://example.com/140",
      abr: 128,
      vbr: 0,
      resolution: "audio only",
    },
    {
      format_id: "251",
      format_note: "audio",
      filesize: 3_900_000,
      filesize_approx: 0,
      acodec: "opus",
      vcodec: "none",
      audio_ext: "webm",
      video_ext: "none",
      ext: "webm",
      container: "webm_dash",
      width: 0,
      height: 0,
      fps: 0,
      url: "https://example.com/251",
      abr: 160,
      vbr: 0,
      resolution: "audio only",
    },
  ],
};

describe("normalizeUrlInput", () => {
  it("drops blank lines, deduplicates urls, and reports invalid lines", () => {
    const result = normalizeUrlInput(
      [
        "https://example.com/a",
        "",
        "not-a-url",
        "https://example.com/a",
        "http://example.com/b",
      ].join("\n"),
    );

    expect(result.urls).toEqual(["https://example.com/a", "http://example.com/b"]);
    expect(result.invalidLines).toEqual(["not-a-url"]);
  });
});

describe("download request builders", () => {
  it("builds compact payload with best audio attached for separate streams", () => {
    const request = buildCompactDownloadRequest(
      sampleMetadata.original_url,
      sampleMetadata,
      "video:720p",
    );

    expect(request).toEqual({
      url: sampleMetadata.original_url,
      format_id: "136+251",
    });
  });

  it("builds expanded original payload with auto audio", () => {
    const config: ExpandedConfig = {
      isExpanded: true,
      videoFormatId: "136",
      audioFormatId: "auto",
      mode: "original",
      container: null,
      vcodec: null,
      acodec: null,
    };

    const request = buildExpandedDownloadRequest(sampleMetadata.original_url, sampleMetadata, config);
    expect(request).toEqual({
      url: sampleMetadata.original_url,
      format_id: "136+251",
    });
  });

  it("builds expanded convert payload with explicit container and codecs", () => {
    const config = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      videoFormatId: "247",
      audioFormatId: "140",
      mode: "convert",
      container: "webm",
      vcodec: "vp9",
      acodec: "opus",
    });

    const request = buildExpandedDownloadRequest(sampleMetadata.original_url, sampleMetadata, config);
    expect(request).toEqual({
      url: sampleMetadata.original_url,
      format_id: "247+140",
      options: {
        container: "webm",
        vcodec: "vp9",
        acodec: "opus",
      },
    });
  });
});
