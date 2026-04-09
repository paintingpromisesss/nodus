package server

import "errors"

var (
	ErrInvalidRequestBody       = errors.New("invalid request body")
	ErrUrlsRequired             = errors.New("urls are required")
	ErrURLRequired              = errors.New("url is required")
	ErrFormatIDRequired         = errors.New("format_id is required")
	ErrYtdlpClientNotConfigured = errors.New("ytdlp client is not configured")
)
