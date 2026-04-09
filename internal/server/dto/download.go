package dto

type DownloadRequest struct {
	URL      string `json:"url"`
	FormatID string `json:"format_id"`
}
