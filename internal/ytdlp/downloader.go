package ytdlp

import (
	"context"
	"fmt"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/paintingpromisesss/cobalt_bot/internal/downloader"
)

type Downloader struct {
	tempDir string
}

func New(tempDir string) *Downloader {
	return &Downloader{tempDir: tempDir}
}

func (d *Downloader) Download(ctx context.Context, sourceURL, preferredFilename string) (downloader.DownloadResult, error) {
	if strings.TrimSpace(sourceURL) == "" {
		return downloader.DownloadResult{}, fmt.Errorf("source url is required")
	}
	if strings.TrimSpace(d.tempDir) == "" {
		return downloader.DownloadResult{}, fmt.Errorf("temp dir is required")
	}

	if err := os.MkdirAll(d.tempDir, 0o755); err != nil {
		return downloader.DownloadResult{}, fmt.Errorf("create temp dir: %w", err)
	}

	workDir, err := os.MkdirTemp(d.tempDir, "yt-dlp-*")
	if err != nil {
		return downloader.DownloadResult{}, fmt.Errorf("create yt-dlp work dir: %w", err)
	}
	defer func() {
		_ = os.RemoveAll(workDir)
	}()

	outputTemplate := filepath.Join(workDir, "download.%(ext)s")
	cmd := exec.CommandContext(ctx, "yt-dlp",
		"--no-cache-dir",
		"--no-progress",
		"--format", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
		"--merge-output-format", "mp4",
		"--output", outputTemplate,
		sourceURL,
	)
	cmd.Env = append(os.Environ(),
		"HOME="+workDir,
		"XDG_CACHE_HOME="+filepath.Join(workDir, ".cache"),
		"TMPDIR="+workDir,
		"TEMP="+workDir,
		"TMP="+workDir,
		"YT_DLP_NO_CACHE_DIR=1",
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return downloader.DownloadResult{}, fmt.Errorf("yt-dlp download failed: %w: %s", err, strings.TrimSpace(string(output)))
	}

	downloadedPath, err := pickDownloadedFile(workDir)
	if err != nil {
		return downloader.DownloadResult{}, err
	}

	finalPath := filepath.Join(d.tempDir, fmt.Sprintf("ytdlp-%d%s", time.Now().UnixNano(), filepath.Ext(downloadedPath)))
	if err := os.Rename(downloadedPath, finalPath); err != nil {
		return downloader.DownloadResult{}, fmt.Errorf("move yt-dlp output: %w", err)
	}

	info, err := os.Stat(finalPath)
	if err != nil {
		return downloader.DownloadResult{}, fmt.Errorf("stat yt-dlp output: %w", err)
	}
	if info.Size() == 0 {
		return downloader.DownloadResult{}, downloader.ErrEmptyFile
	}

	filename := strings.TrimSpace(preferredFilename)
	if filename == "" {
		filename = filepath.Base(finalPath)
	}

	return downloader.DownloadResult{
		Path:         finalPath,
		Filename:     filename,
		Size:         info.Size(),
		DetectedMIME: detectMIME(finalPath, filename),
	}, nil
}

func pickDownloadedFile(workDir string) (string, error) {
	entries, err := os.ReadDir(workDir)
	if err != nil {
		return "", fmt.Errorf("read yt-dlp work dir: %w", err)
	}

	type candidate struct {
		path string
		size int64
	}

	candidates := make([]candidate, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".part") || strings.HasSuffix(name, ".ytdl") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return "", fmt.Errorf("stat yt-dlp candidate: %w", err)
		}
		candidates = append(candidates, candidate{
			path: filepath.Join(workDir, name),
			size: info.Size(),
		})
	}

	if len(candidates) == 0 {
		return "", fmt.Errorf("yt-dlp did not produce a downloadable file")
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].size > candidates[j].size
	})

	return candidates[0].path, nil
}

func detectMIME(filePath, filename string) string {
	if file, err := os.Open(filePath); err == nil {
		defer file.Close()
		buf := make([]byte, 512)
		if n, readErr := file.Read(buf); readErr == nil || n > 0 {
			sniffed := strings.TrimSpace(strings.Split(http.DetectContentType(buf[:n]), ";")[0])
			if sniffed != "" && sniffed != "application/octet-stream" {
				return sniffed
			}
		}
	}

	extMIME := strings.TrimSpace(strings.Split(mime.TypeByExtension(strings.ToLower(filepath.Ext(filename))), ";")[0])
	if extMIME != "" {
		return extMIME
	}

	return "application/octet-stream"
}
