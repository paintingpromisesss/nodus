package ytdlp

import (
	"context"
	"fmt"
	"mime"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type DownloadResult struct {
	FilePath     string
	Filename     string
	ContentType  string
	DetectedMIME string
}

func (c *Client) Download(ctx context.Context, url, formatID string) (*DownloadResult, error) {
	if strings.TrimSpace(url) == "" {
		return nil, ErrEmptyURL
	}
	if strings.TrimSpace(formatID) == "" {
		return nil, ErrFormatIDRequired
	}

	if err := c.prepareRuntimeDirectories(); err != nil {
		return nil, err
	}

	args := c.buildDownloadArgs(url, formatID)
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
