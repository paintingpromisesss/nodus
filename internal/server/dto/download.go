package dto

type DownloadRequest struct {
	URL             string `json:"url"`
	DownloadOptions `json:"options"`
}

type DownloadOptions struct {
	FormatID  string `json:"format_id"`
	ACodec    string `json:"acodec"`
	VCodec    string `json:"vcodec"`
	Container string `json:"container"`
}
