import { describe, expect, it } from "vitest";
import {
  buildCompactDownloadRequest,
  buildExpandedDownloadRequest,
  coerceExpandedConfig,
  describeCompactSelection,
  describeSelection,
  getCompatibleContainersForConfig,
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
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
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
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
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

  it("formats compact summary as video, audio, container, size", () => {
    expect(describeCompactSelection(sampleMetadata, "video:720p")).toBe(
      "720p H264 | 160 kbps OPUS | MP4 | 51.4 MB",
    );
  });

  it("formats convert summary with target codecs", () => {
    const config = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "247",
      audioFormatId: "140",
      mode: "convert",
      container: "webm",
      vcodec: "vp9",
      acodec: "opus",
    });

    expect(describeSelection(sampleMetadata, config)).toBe(
      "720p VP9 | 128 kbps OPUS | WEBM | 49.0 MB",
    );
  });

  it("filters remux containers by selected source codecs", () => {
    const config = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: false,
      includeAudio: true,
      videoFormatId: "136",
      audioFormatId: "251",
      mode: "remux",
      container: "m4a",
      vcodec: null,
      acodec: null,
    });

    expect(getCompatibleContainersForConfig(sampleMetadata, config)).toEqual(
      expect.arrayContaining(["mp4", "ogg", "opus", "mkv"]),
    );
    expect(getCompatibleContainersForConfig(sampleMetadata, config)).not.toContain("m4a");
    expect(getCompatibleContainersForConfig(sampleMetadata, config)).not.toContain("mp3");
    expect(getCompatibleContainersForConfig(sampleMetadata, config)).not.toContain("wav");
  });

  it("normalizes invalid remux containers to a compatible option", () => {
    const config = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: false,
      includeAudio: true,
      videoFormatId: "136",
      audioFormatId: "251",
      mode: "remux",
      container: "mp3",
      vcodec: null,
      acodec: null,
    });

    expect(config.container).not.toBe("mp3");
    expect(["mp4", "ogg", "opus", "mkv"]).toContain(config.container);
  });

  it("keeps audio-only remux state valid when a muxed video format exists in background selection", () => {
    const config = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: false,
      includeAudio: true,
      videoFormatId: "18",
      audioFormatId: "140",
      mode: "remux",
      container: null,
      vcodec: null,
      acodec: null,
    });

    expect(config.audioFormatId).toBe("140");
    expect(config.container).toBe("m4a");

    expect(buildExpandedDownloadRequest(sampleMetadata.original_url, sampleMetadata, config)).toEqual({
      url: sampleMetadata.original_url,
      format_id: "140",
      options: {
        container: "m4a",
      },
    });
  });

  it("accepts raw yt-dlp codec strings when resolving remux containers", () => {
    const metadataWithRawCodecs: MediaMetadata = {
      ...sampleMetadata,
      formats: [
        {
          ...sampleMetadata.formats[1],
          format_id: "401",
          vcodec: "av01.0.08M.08",
        },
        {
          ...sampleMetadata.formats[3],
          format_id: "139",
          acodec: "mp4a.40.2",
          abr: 48,
        },
      ],
    };

    const config = coerceExpandedConfig(metadataWithRawCodecs, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "401",
      audioFormatId: "139",
      mode: "remux",
      container: null,
      vcodec: null,
      acodec: null,
    });

    expect(getCompatibleContainersForConfig(metadataWithRawCodecs, config)).toEqual(
      expect.arrayContaining(["mp4", "mkv"]),
    );
    expect(config.container).toBe("mp4");
  });

  it("keeps source audio enabled when only muxed video formats are available", () => {
    const muxedOnlyMetadata: MediaMetadata = {
      ...sampleMetadata,
      formats: [
        {
          ...sampleMetadata.formats[0],
          format_id: "18",
        },
      ],
    };

    const config = coerceExpandedConfig(muxedOnlyMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: false,
      videoFormatId: "18",
      audioFormatId: "auto",
      mode: "original",
      container: null,
      vcodec: null,
      acodec: null,
    });

    expect(config.includeAudio).toBe(true);
  });

  it("keeps source audio enabled when the selected video format is muxed", () => {
    const config = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: false,
      videoFormatId: "18",
      audioFormatId: "auto",
      mode: "original",
      container: null,
      vcodec: null,
      acodec: null,
    });

    expect(config.includeAudio).toBe(true);
  });

  it("keeps source video enabled when only muxed formats are available", () => {
    const muxedOnlyMetadata: MediaMetadata = {
      ...sampleMetadata,
      formats: [
        {
          ...sampleMetadata.formats[0],
          format_id: "18",
        },
      ],
    };

    const config = coerceExpandedConfig(muxedOnlyMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: false,
      includeAudio: true,
      videoFormatId: "18",
      audioFormatId: "auto",
      mode: "original",
      container: null,
      vcodec: null,
      acodec: null,
    });

    expect(config.includeVideo).toBe(true);
  });

  it("preserves quick quality override flag when normalizing config", () => {
    const config = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "136",
      audioFormatId: "auto",
      mode: "original",
      container: null,
      vcodec: null,
      acodec: null,
    });

    expect(config.overrideQuickQuality).toBe(true);
  });
});
