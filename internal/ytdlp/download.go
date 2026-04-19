package ytdlp

import (
	"context"
	"fmt"
	"mime"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"unicode"

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

	probeResult, err := c.FFmpegClient.ProbeCodecs(ctx, filePath)
	if err != nil {
		return nil, err
	}

	filePath, err = appendCodecsToFilename(filePath, probeResult)
	if err != nil {
		return nil, err
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

func appendCodecsToFilename(filePath string, probeResult *ffmpeg.ProbeResult) (string, error) {
	if probeResult == nil {
		return filePath, nil
	}

	codecs := make([]string, 0, 2)
	if videoCodec := strings.TrimSpace(probeResult.VideoCodec); videoCodec != "" {
		codecs = append(codecs, videoCodec)
	}
	if audioCodec := strings.TrimSpace(probeResult.AudioCodec); audioCodec != "" {
		codecs = append(codecs, audioCodec)
	}

	if len(codecs) == 0 {
		return filePath, nil
	}

	dir := filepath.Dir(filePath)
	ext := filepath.Ext(filePath)
	base := normalizeFilenameBase(strings.TrimSuffix(filepath.Base(filePath), ext))
	targetPath := filepath.Join(dir, fmt.Sprintf("%s [%s]%s", base, strings.Join(codecs, " + "), ext))

	if targetPath == filePath {
		return filePath, nil
	}

	if _, err := os.Stat(targetPath); err == nil {
		return filePath, nil
	} else if !os.IsNotExist(err) {
		return "", fmt.Errorf("stat renamed download path: %w", err)
	}

	if err := os.Rename(filePath, targetPath); err != nil {
		return "", fmt.Errorf("rename downloaded file with codecs: %w", err)
	}

	return targetPath, nil
}

func normalizeFilenameBase(name string) string {
	name = strings.Map(func(r rune) rune {
		switch r {
		case '＂', '“', '”', '„', '‟', '«', '»', '〝', '〞':
			return '\''
		case '‘', '’', '‚', '‛':
			return '\''
		}

		if unicode.IsSpace(r) {
			return ' '
		}

		return r
	}, name)

	name = strings.Join(strings.Fields(name), " ")
	name = strings.Trim(name, " .")
	if name == "" {
		return "download"
	}

	return name
}
