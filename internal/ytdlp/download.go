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

	if options.Container != "" || options.ACodec != "" || options.VCodec != "" {
		convertedPath, err := convertMediaFile(ctx, filePath, options)
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

func convertMediaFile(ctx context.Context, inputPath string, options DownloadOptions) (string, error) {
	container := options.Container
	if container == "" {
		container = strings.TrimPrefix(strings.ToLower(filepath.Ext(inputPath)), ".")
	}
	outputPath := strings.TrimSuffix(inputPath, filepath.Ext(inputPath)) + ".converted." + container

	videoCodec, ok := ffmpegVideoCodecs[options.VCodec]
	if !ok {
		videoCodec = "copy"
	}
	audioCodec, ok := ffmpegAudioCodecs[options.ACodec]
	if !ok {
		audioCodec = "copy"
	}

	args := []string{"-y", "-i", inputPath}
	if options.VCodec == "none" {
		args = append(args, "-vn")
	} else {
		args = append(args, "-c:v", videoCodec)
	}
	if options.ACodec == "none" {
		args = append(args, "-an")
	} else {
		args = append(args, "-c:a", audioCodec)
	}
	args = append(args, outputPath)

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ffmpeg post-process failed: %w: %s", err, strings.TrimSpace(string(output)))
	}

	return outputPath, nil
}

var ffmpegVideoCodecs = map[string]string{
	"h264": "libx264",
	"hevc": "libx265",
	"av1":  "libaom-av1",
	"vp9":  "libvpx-vp9",
	"vp8":  "libvpx",
}

var ffmpegAudioCodecs = map[string]string{
	"aac":    "aac",
	"mp3":    "libmp3lame",
	"opus":   "libopus",
	"vorbis": "libvorbis",
}
