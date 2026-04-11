package ytdlp

import "slices"

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

func isCompatible(container, vcodec, acodec string) bool {
	params, ok := allowed[container]
	if !ok {
		return false
	}
	allowedVideo := false
	allowedAudio := false
	if vcodec != "none" {
		if slices.Contains(params.Video, vcodec) {
			allowedVideo = true
		}
	}
	if acodec != "none" {
		if slices.Contains(params.Audio, acodec) {
			allowedAudio = true
		}
	}

	return allowedVideo && allowedAudio
}
