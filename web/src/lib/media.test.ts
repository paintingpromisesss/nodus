import { describe, expect, it } from "vitest";
import {
  buildCompactDownloadRequest,
  buildExpandedDownloadRequest,
  createInitialExpandedConfig,
  coerceExpandedConfig,
  describeCompactSelection,
  describeSelection,
  getCompactChoices,
  getAudioCodecOptions,
  getCompatibleContainersForConfig,
  getOriginalContainerDisplay,
  getSourceCodecsForConfig,
  getVideoCodecOptions,
  normalizeUrlInput,
  syncExpandedConfigToCompactChoice,
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
  it("excludes muxed video formats from quick quality choices", () => {
    expect(getCompactChoices(sampleMetadata, "quality").map((choice) => choice.id)).toEqual(["video:720p"]);
  });

  it("prefers the highest bitrate candidate in quick quality mode", () => {
    const [choice] = getCompactChoices(sampleMetadata, "quality");

    expect(choice?.preferredFormat.format_id).toBe("136");
  });

  it("prefers the lowest bitrate candidate in quick size mode", () => {
    const [choice] = getCompactChoices(sampleMetadata, "size");

    expect(choice?.preferredFormat.format_id).toBe("247");
  });

  it("uses muxed formats in quick compatibility mode", () => {
    expect(getCompactChoices(sampleMetadata, "compatibility").map((choice) => choice.id)).toEqual(["video:360p"]);
  });

  it("returns no quick compatibility choices without muxed formats", () => {
    const metadataWithoutMuxed = {
      ...sampleMetadata,
      formats: sampleMetadata.formats.filter((format) => format.format_id !== "18"),
    };

    expect(getCompactChoices(metadataWithoutMuxed, "compatibility")).toEqual([]);
  });

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

  it("builds compact payload with the smallest bitrate candidate in size mode", () => {
    const request = buildCompactDownloadRequest(
      sampleMetadata.original_url,
      sampleMetadata,
      "video:720p",
      "size",
    );

    expect(request).toEqual({
      url: sampleMetadata.original_url,
      format_id: "247+251",
    });
  });

  it("builds compact payload from one muxed format in compatibility mode", () => {
    const request = buildCompactDownloadRequest(
      sampleMetadata.original_url,
      sampleMetadata,
      "video:360p",
      "compatibility",
    );

    expect(request).toEqual({
      url: sampleMetadata.original_url,
      format_id: "18",
    });
  });

  it("applies output conversion to a quick quality choice without enabling manual input override", () => {
    const outputConfig = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: false,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "136",
      audioFormatId: "251",
      mode: "convert",
      container: "mp4",
      vcodec: "h264",
      acodec: "aac",
    });

    expect(outputConfig.overrideQuickQuality).toBe(false);
    expect(describeCompactSelection(sampleMetadata, "video:720p", "quality", outputConfig)).toBe(
      "720p H264 | 160 kbps AAC | MP4 | 51.4 MB",
    );
    expect(buildCompactDownloadRequest(
      sampleMetadata.original_url,
      sampleMetadata,
      "video:720p",
      "quality",
      outputConfig,
    )).toEqual({
      url: sampleMetadata.original_url,
      format_id: "136+251",
      options: {
        container: "mp4",
        vcodec: "h264",
        acodec: "aac",
      },
    });
  });

  it("syncs output config to the quick quality candidate when mode changes", () => {
    const qualityConfig = syncExpandedConfigToCompactChoice(
      sampleMetadata,
      createInitialExpandedConfig(sampleMetadata),
      "video:720p",
      "quality",
    );
    const sizeConfig = syncExpandedConfigToCompactChoice(
      sampleMetadata,
      createInitialExpandedConfig(sampleMetadata),
      "video:720p",
      "size",
    );

    expect(qualityConfig.videoFormatId).toBe("136");
    expect(qualityConfig.audioFormatId).toBe("251");
    expect(qualityConfig.container).toBe("mp4");

    expect(sizeConfig.videoFormatId).toBe("247");
    expect(sizeConfig.audioFormatId).toBe("251");
    expect(sizeConfig.container).toBe("webm");
  });

  it("resets target codecs to the new source codecs when quick mode changes in convert mode", () => {
    const initialConfig = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: false,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "136",
      audioFormatId: "251",
      mode: "convert",
      container: "mkv",
      vcodec: "h264",
      acodec: "opus",
    });

    const sizeConfig = syncExpandedConfigToCompactChoice(
      sampleMetadata,
      initialConfig,
      "video:720p",
      "size",
    );

    expect(sizeConfig.videoFormatId).toBe("247");
    expect(sizeConfig.container).toBe("mp4");
    expect(sizeConfig.vcodec).toBe("vp9");
    expect(sizeConfig.acodec).toBe("opus");
  });

  it("resets container to the new default when quick mode changes", () => {
    const initialConfig = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: false,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "247",
      audioFormatId: "251",
      mode: "convert",
      container: "webm",
      vcodec: "vp9",
      acodec: "opus",
    });

    const qualityConfig = syncExpandedConfigToCompactChoice(
      sampleMetadata,
      initialConfig,
      "video:720p",
      "quality",
    );

    expect(qualityConfig.videoFormatId).toBe("136");
    expect(qualityConfig.container).toBe("mp4");
    expect(qualityConfig.vcodec).toBe("h264");
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

  it("shows all compatible original containers for separate video and audio streams without a default", () => {
    const display = getOriginalContainerDisplay(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "247",
      audioFormatId: "140",
      mode: "original",
      container: null,
      vcodec: null,
      acodec: null,
    });

    expect(display).toEqual({
      containers: ["mp4", "mkv"],
      showDefault: false,
    });
  });

  it("keeps a single default original container for muxed streams", () => {
    const display = getOriginalContainerDisplay(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "18",
      audioFormatId: "auto",
      mode: "original",
      container: null,
      vcodec: null,
      acodec: null,
    });

    expect(display).toEqual({
      containers: ["mp4"],
      showDefault: true,
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

  it("defaults convert codecs to source copy options and removes duplicate codec entries", () => {
    const config = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "247",
      audioFormatId: "140",
      mode: "convert",
      container: "webm",
      vcodec: null,
      acodec: null,
    });

    const sourceCodecs = getSourceCodecsForConfig(sampleMetadata, config);
    const videoCodecOptions = getVideoCodecOptions(config.container!, true, sourceCodecs.video);
    const audioCodecOptions = getAudioCodecOptions(config.container!, true, sourceCodecs.audio);

    expect(config.vcodec).toBe("vp9");
    expect(config.acodec).toBe("opus");
    expect(videoCodecOptions).toEqual(["vp9", "vp8", "av1"]);
    expect(audioCodecOptions).toEqual(["opus", "vorbis"]);
  });

  it("rebuilds copy option when selected source codecs change", () => {
    const av1Metadata: MediaMetadata = {
      ...sampleMetadata,
      formats: sampleMetadata.formats.map((format) =>
        format.format_id === "247"
          ? {
              ...format,
              format_id: "401",
              vcodec: "av01.0.08M.08",
            }
          : format,
      ),
    };

    const av1Config = coerceExpandedConfig(av1Metadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "401",
      audioFormatId: "140",
      mode: "convert",
      container: "mp4",
      vcodec: null,
      acodec: null,
    });
    const av1SourceCodecs = getSourceCodecsForConfig(av1Metadata, av1Config);

    const h264Config = coerceExpandedConfig(sampleMetadata, {
      ...av1Config,
      videoFormatId: "136",
      container: "mp4",
      vcodec: null,
    });
    const h264SourceCodecs = getSourceCodecsForConfig(sampleMetadata, h264Config);

    expect(getVideoCodecOptions("mp4", true, av1SourceCodecs.video)).toEqual(["av1", "h264", "hevc", "vp9"]);
    expect(getVideoCodecOptions("mp4", true, h264SourceCodecs.video)).toEqual(["h264", "hevc", "av1", "vp9"]);
  });

  it("resets codecs back to source copy options when leaving convert mode", () => {
    const convertConfig = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "247",
      audioFormatId: "251",
      mode: "convert",
      container: "mov",
      vcodec: "h264",
      acodec: "aac",
    });

    expect(convertConfig.vcodec).toBe("h264");
    expect(convertConfig.acodec).toBe("aac");

    const remuxConfig = coerceExpandedConfig(sampleMetadata, {
      ...convertConfig,
      mode: "remux",
      container: "mp4",
    });

    expect(remuxConfig.vcodec).toBe("vp9");
    expect(remuxConfig.acodec).toBe("opus");
  });

  it("keeps compatible remux output selections when switching to convert", () => {
    const remuxConfig = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: false,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "247",
      audioFormatId: "140",
      mode: "remux",
      container: "mp4",
      vcodec: null,
      acodec: null,
    });

    expect(remuxConfig.container).toBe("mp4");
    expect(remuxConfig.vcodec).toBe("vp9");
    expect(remuxConfig.acodec).toBe("aac");

    const convertConfig = coerceExpandedConfig(sampleMetadata, {
      ...remuxConfig,
      mode: "convert",
    });

    expect(convertConfig.overrideQuickQuality).toBe(false);
    expect(convertConfig.container).toBe("mp4");
    expect(convertConfig.vcodec).toBe("vp9");
    expect(convertConfig.acodec).toBe("aac");
  });

  it("defaults to mp4 when switching from original source ext to convert", () => {
    const originalConfig = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "247",
      audioFormatId: "140",
      mode: "original",
      container: null,
      vcodec: null,
      acodec: null,
    });

    expect(originalConfig.container).toBe("webm");
    expect(originalConfig.acodec).toBe("aac");

    const convertConfig = coerceExpandedConfig(sampleMetadata, {
      ...originalConfig,
      mode: "convert",
      container: null,
      vcodec: null,
      acodec: null,
    });

    expect(convertConfig.container).toBe("mp4");
    expect(convertConfig.vcodec).toBe("vp9");
    expect(convertConfig.acodec).toBe("aac");
    expect(describeSelection(sampleMetadata, convertConfig)).toBe(
      "720p VP9 | 128 kbps AAC | MP4 | 49.0 MB",
    );
  });

  it("uses the real output container and source codecs in original mode instead of stale convert state", () => {
    const originalConfig = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "247",
      audioFormatId: "251",
      mode: "original",
      container: "mov",
      vcodec: "h264",
      acodec: "aac",
    });

    expect(originalConfig.container).toBe("webm");
    expect(originalConfig.vcodec).toBe("vp9");
    expect(originalConfig.acodec).toBe("opus");
  });

  it("uses source video ext for original mode even when source codecs are mp4-compatible", () => {
    const originalConfig = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "247",
      audioFormatId: "140",
      mode: "original",
      container: "webm",
      vcodec: "vp9",
      acodec: "opus",
    });

    expect(originalConfig.container).toBe("webm");
    expect(originalConfig.vcodec).toBe("vp9");
    expect(originalConfig.acodec).toBe("aac");
    expect(describeSelection(sampleMetadata, originalConfig)).toBe(
      "720p VP9 | 128 kbps AAC | WEBM | 49.0 MB",
    );
  });

  it("defaults back to source copy codecs when convert container becomes compatible again", () => {
    const movConfig = coerceExpandedConfig(sampleMetadata, {
      isExpanded: true,
      overrideQuickQuality: true,
      includeVideo: true,
      includeAudio: true,
      videoFormatId: "247",
      audioFormatId: "251",
      mode: "convert",
      container: "mov",
      vcodec: null,
      acodec: null,
    });

    expect(movConfig.vcodec).toBe("h264");
    expect(movConfig.acodec).toBe("aac");

    const mp4Config = coerceExpandedConfig(sampleMetadata, {
      ...movConfig,
      container: "mp4",
      vcodec: null,
      acodec: null,
    });

    expect(mp4Config.vcodec).toBe("vp9");
    expect(mp4Config.acodec).toBe("opus");
  });

  it("formats compact summary as video, audio, container, size", () => {
    expect(describeCompactSelection(sampleMetadata, "video:720p")).toBe(
      "720p H264 | 160 kbps OPUS | MP4 | 51.4 MB",
    );
  });

  it("formats compact summary using the size-mode candidate", () => {
    expect(describeCompactSelection(sampleMetadata, "video:720p", "size")).toBe(
      "720p VP9 | 160 kbps OPUS | WEBM | 49.5 MB",
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
    expect(["webm", "mp4", "ogg", "opus", "mkv"]).toContain(config.container);
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
