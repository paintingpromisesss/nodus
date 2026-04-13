package ffmpeg

import (
	"context"
	"fmt"
	"os"
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
	outputPath, tempOutputPath, replaceOriginal := buildOutputPaths(inputPath, container)

	args := buildFFmpegArgs(inputPath, tempOutputPath, options)

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ffmpeg conversion failed: %w: %s", err, strings.TrimSpace(string(output)))
	}

	if replaceOriginal {
		if err := os.Remove(inputPath); err != nil {
			_ = os.Remove(tempOutputPath)
			return "", fmt.Errorf("remove original file before replacement: %w", err)
		}
		if err := os.Rename(tempOutputPath, outputPath); err != nil {
			return "", fmt.Errorf("replace original converted file: %w", err)
		}
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

func buildOutputPaths(inputPath, container string) (outputPath, tempOutputPath string, replaceOriginal bool) {
	basePath := strings.TrimSuffix(inputPath, filepath.Ext(inputPath))
	outputPath = basePath + "." + container

	if outputPath == inputPath {
		return outputPath, basePath + ".tmp-convert." + container, true
	}

	return outputPath, outputPath, false
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
	"aac":       "aac",
	"alac":      "alac",
	"flac":      "flac",
	"mp3":       "libmp3lame",
	"opus":      "libopus",
	"pcm_f32le": "pcm_f32le",
	"pcm_s16le": "pcm_s16le",
	"pcm_s24le": "pcm_s24le",
	"vorbis":    "libvorbis",
}
