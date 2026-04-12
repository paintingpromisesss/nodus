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
		Audio: []string{"aac", "mp3", "opus"},
	},
	"webm": {
		Video: []string{"vp9", "vp8"},
		Audio: []string{"opus", "vorbis"},
	},
	"mkv": {
		Video: []string{"h264", "hevc", "av1", "vp9", "vp8"},
		Audio: []string{"aac", "mp3", "opus", "vorbis"},
	},
}

func normalizeCodec(codec string) string {
	return strings.ToLower(strings.TrimSpace(codec))
}

func normalizeContainer(container string) string {
	return strings.ToLower(strings.TrimSpace(container))
}

func validateContainerCodecs(container, vcodec, acodec string) error {
	container = normalizeContainer(container)
	vcodec = normalizeCodec(vcodec)
	acodec = normalizeCodec(acodec)

	if container == "" && vcodec == "" && acodec == "" {
		return nil
	}
	if container == "" && (vcodec != "" || acodec != "") {
		return ErrContainerRequiredForCodecSelection
	}

	params, ok := allowed[container]
	if !ok {
		return fmt.Errorf("%w: %s", ErrUnsupportedContainer, container)
	}

	if vcodec != "" && vcodec != "none" && !slices.Contains(params.Video, vcodec) {
		return fmt.Errorf("%w: %s", ErrUnsupportedVCodec, vcodec)
	}
	if acodec != "" && acodec != "none" && !slices.Contains(params.Audio, acodec) {
		return fmt.Errorf("%w: %s", ErrUnsupportedACodec, acodec)
	}

	if vcodec == "none" && acodec == "none" {
		return ErrNoStreamsSelected
	}

	return nil
}
