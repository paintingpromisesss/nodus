package dto

type DownloadRequest struct {
	URL             string           `json:"url"`
	FormatID        string           `json:"format_id"`
	DownloadOptions *DownloadOptions `json:"options,omitempty"`
}

type DownloadOptions struct {
	ACodec    *string `json:"acodec,omitempty"`
	VCodec    *string `json:"vcodec,omitempty"`
	Container *string `json:"container,omitempty"`
}
