package ytdlp

import "errors"

var (
	ErrMediaDurationTooLong               = errors.New("media duration exceeds limit")
	ErrEmptyURL                           = errors.New("url is required")
	ErrFormatIDRequired                   = errors.New("format id is required")
	ErrDownloadedPathNotFile              = errors.New("downloaded path is not a file")
	ErrUnsupportedContainer               = errors.New("unsupported container")
	ErrUnsupportedVCodec                  = errors.New("unsupported video codec for selected container")
	ErrUnsupportedACodec                  = errors.New("unsupported audio codec for selected container")
	ErrContainerRequiredForCodecSelection = errors.New("container is required when codec is selected")
	ErrNoStreamsSelected                  = errors.New("at least one of video or audio stream must be selected")
)

type Client struct {
	tempDir                string
	MaxDurationSecs        int
	MaxFileBytes           int64
	CurrentlyLiveAvailable bool
	PlaylistAvailable      bool
	JSRuntimeSpec          string
}

func NewClient(tempDir string,
	maxDurationSecs int,
	maxFileBytes int64,
	currentlyLiveAvailable bool,
	playlistAvailable bool,
	useJSRuntime bool,
) *Client {
	normalizedTempDir := normalizeTempDir(tempDir)

	return &Client{
		tempDir:                normalizedTempDir,
		MaxDurationSecs:        maxDurationSecs,
		MaxFileBytes:           maxFileBytes,
		CurrentlyLiveAvailable: currentlyLiveAvailable,
		PlaylistAvailable:      playlistAvailable,
		JSRuntimeSpec:          detectJSRuntimeSpec(useJSRuntime),
	}
}
