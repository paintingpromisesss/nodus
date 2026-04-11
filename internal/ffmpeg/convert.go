package ffmpeg

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

type ConvertOptions struct {
	VCodec    string
	ACodec    string
	Container string
}

func (c *Client) Convert(ctx context.Context, inputPath string, options ConvertOptions) (string, error) {
	container := normalizeContainer(options.Container, inputPath)

	outputPath := strings.TrimPrefix(inputPath, filepath.Ext(inputPath)) + ".converted." + container

	args := buildFFmpegArgs(inputPath, outputPath, options)

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ffmpeg conversion failed: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return outputPath, nil
}

func buildFFmpegArgs(inputPath, outputPath string, options ConvertOptions) []string {
	args := []string{"-y", "-i", inputPath}
	videoCodec := normalizeFFmpegVCodec(options.VCodec)
	audioCodec := normalizeFFmpegACodec(options.ACodec)

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

	return args
}

func normalizeContainer(container, inputPath string) string {
	if container == "" {
		container = strings.TrimPrefix(strings.ToLower(filepath.Ext(inputPath)), ".")
	}

	return container
}

func normalizeFFmpegVCodec(codec string) string {
	if vcodec, ok := ffmpegVideoCodecs[codec]; !ok {
		return "copy"
	} else {
		return vcodec
	}
}

func normalizeFFmpegACodec(codec string) string {
	if acodec, ok := ffmpegAudioCodecs[codec]; !ok {
		return "copy"
	} else {
		return acodec
	}
}

var ffmpegVideoCodecs = map[string]string{
	"h264": "libx264",
	"hevc": "libx265",
	"av1":  "libsvtav1",
	"vp9":  "libvpx-vp9",
	"vp8":  "libvpx",
}

var ffmpegAudioCodecs = map[string]string{
	"aac":    "aac",
	"mp3":    "libmp3lame",
	"opus":   "libopus",
	"vorbis": "libvorbis",
}
