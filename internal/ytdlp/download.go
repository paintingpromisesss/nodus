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

type DownloadOptions struct {
	FormatID  string
	ACodec    *string
	VCodec    *string
	Container *string
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

	if options.Container != nil || options.ACodec != nil || options.VCodec != nil {
		if options.Container != nil && options.ACodec == nil && options.VCodec == nil {
			probeResult, err := c.FFmpegClient.ProbeCodecs(ctx, filePath)
			if err != nil {
				return nil, err
			}

			var videoCodec *string
			if strings.TrimSpace(probeResult.VideoCodec) != "" {
				videoCodec = &probeResult.VideoCodec
			}

			var audioCodec *string
			if strings.TrimSpace(probeResult.AudioCodec) != "" {
				audioCodec = &probeResult.AudioCodec
			}

			if err := validateContainerCodecs(options.Container, videoCodec, audioCodec); err != nil {
				return nil, err
			}
		}

		convertOptions := buildConvertOptions(options)

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
