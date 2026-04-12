package ytdlp

import (
	"context"
	"fmt"
	"mime"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/paintingpromisesss/nodus-backend/internal/ffmpeg"
)

type DownloadResult struct {
	FilePath     string
	Filename     string
	ContentType  string
	DetectedMIME string
}

type DownloadOptions struct {
	FormatID  string
	ACodec    string
	VCodec    string
	Container string
}

func (c *Client) Download(ctx context.Context, url string, options DownloadOptions) (*DownloadResult, error) {
	if strings.TrimSpace(url) == "" {
		return nil, ErrEmptyURL
	}
	if strings.TrimSpace(options.FormatID) == "" {
		return nil, ErrFormatIDRequired
	}
	options.ACodec = normalizeCodec(options.ACodec)
	options.VCodec = normalizeCodec(options.VCodec)
	options.Container = normalizeContainer(options.Container)
	if err := validateContainerCodecs(options.Container, options.VCodec, options.ACodec); err != nil {
		return nil, err
	}

	if err := c.prepareRuntimeDirectories(); err != nil {
		return nil, err
	}

	args := c.buildDownloadArgs(url, options)
	cmd := exec.CommandContext(ctx, "yt-dlp", args...)
	cmd.Env = c.defaultEnvironment()
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("yt-dlp download failed: %w: %s", err, strings.TrimSpace(string(output)))
	}

	filePath, err := parseDownloadedFilePathBytes(output)
	if err != nil {
		return nil, err
	}

	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("stat downloaded file: %w", err)
	}
	if info.IsDir() {
		return nil, ErrDownloadedPathNotFile
	}

	convertOptions := ffmpeg.ConvertOptions{
		VCodec:    options.VCodec,
		ACodec:    options.ACodec,
		Container: options.Container,
	}

	if options.Container != "" || options.ACodec != "" || options.VCodec != "" {
		convertedPath, err := c.FFmpegClient.Convert(ctx, filePath, convertOptions)
		if err != nil {
			return nil, err
		}
		if convertedPath != filePath {
			_ = os.Remove(filePath)
			filePath = convertedPath
		}
	}

	contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(filePath)))
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	return &DownloadResult{
		FilePath:     filePath,
		Filename:     filepath.Base(filePath),
		ContentType:  contentType,
		DetectedMIME: contentType,
	}, nil
}
