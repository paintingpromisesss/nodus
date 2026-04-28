package ytdlp

import (
	"fmt"
	"slices"
	"strings"
)

type Params struct {
	Video []string
	Audio []string
}

var allowed = map[string]Params{
	"mp4": {
		Video: []string{"h264", "hevc", "av1", "vp9"},
		Audio: []string{"aac", "alac", "flac", "mp3", "opus"},
	},
	"mov": {
		Video: []string{"h264", "hevc"},
		Audio: []string{"aac", "alac", "mp3", "pcm_s16le", "pcm_s24le", "pcm_f32le"},
	},
	"m4a": {
		Audio: []string{"aac", "alac", "mp3"},
	},
	"webm": {
		Video: []string{"vp9", "vp8", "av1"},
		Audio: []string{"opus", "vorbis"},
	},
	"ogg": {
		Audio: []string{"opus", "vorbis", "flac"},
	},
	"opus": {
		Audio: []string{"opus"}, // alias for ogg+opus
	},
	"mp3": {
		Audio: []string{"mp3"},
	},
	"flac": {
		Audio: []string{"flac"},
	},
	"wav": {
		Audio: []string{"pcm_s16le", "pcm_s24le", "pcm_f32le"},
	},
	"mkv": {
		Video: []string{"h264", "hevc", "av1", "vp9", "vp8"},
		Audio: []string{"aac", "alac", "flac", "mp3", "opus", "pcm_s16le", "pcm_s24le", "pcm_f32le", "vorbis"},
	},
}

func normalizeCodec(codec *string) *string {
	if codec == nil {
		return nil
	}
	normalized := normalizeCodecValue(*codec)
	if normalized == "" {
		return nil
	}
	return &normalized
}

func normalizeContainer(container *string) *string {
	if container == nil {
		return nil
	}
	normalized := strings.ToLower(strings.TrimSpace(*container))
	if normalized == "" {
		return nil
	}
	return &normalized
}

func validateContainerCodecs(container, vcodec, acodec *string) error {
	container = normalizeContainer(container)
	vcodec = normalizeCodec(vcodec)
	acodec = normalizeCodec(acodec)

	if container == nil && vcodec == nil && acodec == nil {
		return nil
	}
	if container == nil && (vcodec != nil || acodec != nil) {
		return ErrContainerRequiredForCodecSelection
	}

	params, ok := allowed[*container]
	if !ok {
		return fmt.Errorf("%w: %s", ErrUnsupportedContainer, *container)
	}

	if vcodec != nil && *vcodec != "none" && !slices.Contains(params.Video, *vcodec) {
		return fmt.Errorf("%w: %s", ErrUnsupportedVCodec, *vcodec)
	}
	if acodec != nil && *acodec != "none" && !slices.Contains(params.Audio, *acodec) {
		return fmt.Errorf("%w: %s", ErrUnsupportedACodec, *acodec)
	}

	if vcodec != nil && *vcodec == "none" && acodec != nil && *acodec == "none" {
		return ErrNoStreamsSelected
	}

	return nil
}

func normalizeCodecValue(codec string) string {
	normalized := strings.ToLower(strings.TrimSpace(codec))
	if normalized == "" {
		return ""
	}

	switch {
	case strings.HasPrefix(normalized, "av01"):
		return "av1"
	case strings.HasPrefix(normalized, "avc1"), strings.HasPrefix(normalized, "avc3"), normalized == "h264":
		return "h264"
	case strings.HasPrefix(normalized, "hev1"), strings.HasPrefix(normalized, "hvc1"), normalized == "hevc":
		return "hevc"
	case strings.HasPrefix(normalized, "vp09"), normalized == "vp9":
		return "vp9"
	case strings.HasPrefix(normalized, "vp08"), normalized == "vp8":
		return "vp8"
	case strings.HasPrefix(normalized, "mp4a"), normalized == "aac":
		return "aac"
	default:
		return normalized
	}
}
