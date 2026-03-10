package sender

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type videoMetadata struct {
	Width    int
	Height   int
	Duration int
}

type ffprobeOutput struct {
	Streams []ffprobeStream `json:"streams"`
	Format  ffprobeFormat   `json:"format"`
}

type ffprobeStream struct {
	CodecType string `json:"codec_type"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	Duration  string `json:"duration"`
}

type ffprobeFormat struct {
	Duration string `json:"duration"`
}

func probeVideoMetadata(filePath string, timeout time.Duration) (videoMetadata, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffprobe",
		"-v", "error",
		"-show_format",
		"-show_streams",
		"-print_format", "json",
		filePath,
	)

	output, err := cmd.Output()
	if err != nil {
		return videoMetadata{}, fmt.Errorf("run ffprobe: %w", err)
	}

	var parsed ffprobeOutput
	if err := json.Unmarshal(output, &parsed); err != nil {
		return videoMetadata{}, fmt.Errorf("decode ffprobe output: %w", err)
	}

	for _, stream := range parsed.Streams {
		if stream.CodecType != "video" {
			continue
		}

		duration, err := parseDurationSeconds(stream.Duration)
		if err != nil {
			duration, err = parseDurationSeconds(parsed.Format.Duration)
			if err != nil {
				return videoMetadata{}, fmt.Errorf("extract duration: %w", err)
			}
		}

		if stream.Width <= 0 || stream.Height <= 0 {
			return videoMetadata{}, fmt.Errorf("invalid video dimensions")
		}

		return videoMetadata{
			Width:    stream.Width,
			Height:   stream.Height,
			Duration: duration,
		}, nil
	}

	return videoMetadata{}, fmt.Errorf("video stream not found")
}

func generateVideoThumbnail(filePath string, duration int, timeout time.Duration) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	thumbFile, err := os.CreateTemp("", "cobalt-thumb-*.jpg")
	if err != nil {
		return "", fmt.Errorf("create temp thumbnail: %w", err)
	}
	thumbPath := thumbFile.Name()
	if err := thumbFile.Close(); err != nil {
		cleanupFile(thumbPath)
		return "", fmt.Errorf("close temp thumbnail: %w", err)
	}

	seekSeconds := chooseThumbnailSecond(duration)
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-y",
		"-ss", strconv.Itoa(seekSeconds),
		"-i", filePath,
		"-frames:v", "1",
		"-q:v", "2",
		thumbPath,
	)

	if output, err := cmd.CombinedOutput(); err != nil {
		cleanupFile(thumbPath)
		return "", fmt.Errorf("run ffmpeg: %w: %s", err, strings.TrimSpace(string(output)))
	}

	info, err := os.Stat(thumbPath)
	if err != nil {
		cleanupFile(thumbPath)
		return "", fmt.Errorf("stat thumbnail: %w", err)
	}
	if info.Size() == 0 {
		cleanupFile(thumbPath)
		return "", fmt.Errorf("thumbnail is empty")
	}

	return filepath.Clean(thumbPath), nil
}

func remuxStreamableMP4(filePath string, timeout time.Duration) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	outputFile, err := os.CreateTemp("", "cobalt-streamable-*.mp4")
	if err != nil {
		return "", fmt.Errorf("create temp remux file: %w", err)
	}
	outputPath := outputFile.Name()
	if err := outputFile.Close(); err != nil {
		cleanupFile(outputPath)
		return "", fmt.Errorf("close temp remux file: %w", err)
	}

	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-y",
		"-i", filePath,
		"-map", "0",
		"-c", "copy",
		"-movflags", "+faststart",
		"-f", "mp4",
		outputPath,
	)

	if output, err := cmd.CombinedOutput(); err != nil {
		cleanupFile(outputPath)
		return "", fmt.Errorf("run ffmpeg remux: %w: %s", err, strings.TrimSpace(string(output)))
	}

	info, err := os.Stat(outputPath)
	if err != nil {
		cleanupFile(outputPath)
		return "", fmt.Errorf("stat remux file: %w", err)
	}
	if info.Size() == 0 {
		cleanupFile(outputPath)
		return "", fmt.Errorf("remux output is empty")
	}

	return filepath.Clean(outputPath), nil
}

func chooseThumbnailSecond(duration int) int {
	if duration <= 0 {
		return 1
	}

	second := duration / 5
	if second < 1 {
		second = 1
	}
	if second > 15 {
		second = 15
	}
	return second
}

func parseDurationSeconds(raw string) (int, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, fmt.Errorf("empty duration")
	}

	seconds, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0, err
	}
	if seconds <= 0 {
		return 0, fmt.Errorf("non-positive duration")
	}

	return int(math.Round(seconds)), nil
}

func cleanupFile(path string) {
	if strings.TrimSpace(path) == "" {
		return
	}
	_ = os.Remove(path)
}
