package repository

import "context"

type UserSettings struct {
	VideoQuality          string
	DownloadMode          string
	AudioFormat           string
	AudioBitrate          string
	FilenameStyle         string
	YoutubeVideoCodec     string
	YoutubeVideoContainer string
	YoutubeBetterAudio    bool
	SubtitleLang          string
}

type UserSettingsRepository interface {
	GetByUserID(ctx context.Context, userID int64) (UserSettings, bool, error)
	UpsertByUserID(ctx context.Context, userID int64, settings UserSettings) error
}
