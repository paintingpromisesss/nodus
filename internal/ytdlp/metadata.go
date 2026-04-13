package ytdlp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

type FetchOptions struct {
	UseAllClients bool
}

type MediaMetadata struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Thumbnail   string   `json:"thumbnail"`
	IsLive      bool     `json:"is_live"`
	MediaType   string   `json:"media_type"`
	OriginalURL string   `json:"original_url"`
	Duration    int      `json:"duration"`
	Formats     []Format `json:"formats"`
}

type Format struct {
	FormatID       string  `json:"format_id"`
	FormatNote     string  `json:"format_note"`
	FileSize       int64   `json:"filesize"`
	FileSizeApprox int64   `json:"filesize_approx"`
	ACodec         string  `json:"acodec"`
	VCodec         string  `json:"vcodec"`
	Ext            string  `json:"ext"`
	Container      string  `json:"container"`
	Width          int     `json:"width"`
	Height         int     `json:"height"`
	FPS            float64 `json:"fps"`
	URL            string  `json:"url"`
	ABR            float64 `json:"abr"`
	VBR            float64 `json:"vbr"`
	Resolution     string  `json:"resolution"`
}

type MetadataEvent struct {
	Index int
	URL   string
	Data  *MediaMetadata
	Err   error
}

func (c *Client) StreamMetadata(ctx context.Context, urls []string, options FetchOptions, emit func(MetadataEvent)) error {
	for i, url := range urls {
		if err := ctx.Err(); err != nil {
			return err
		}

		data, err := c.fetchMetadata(ctx, url, options)

		emit(MetadataEvent{
			Index: i,
			URL:   url,
			Data:  data,
			Err:   err,
		})

		if err := ctx.Err(); err != nil {
			return err
		}
	}

	return nil
}

func (c *Client) fetchMetadata(ctx context.Context, url string, options FetchOptions) (*MediaMetadata, error) {
	if strings.TrimSpace(url) == "" {
		return nil, ErrEmptyURL
	}

	args := c.buildFetchMetadataArgs(url, options.UseAllClients)
	cmd := exec.CommandContext(ctx, "yt-dlp", args...)

	if err := c.prepareRuntimeDirectories(); err != nil {
		return nil, err
	}

	cmd.Env = c.defaultEnvironment()
	output, err := cmd.Output()
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			stderr := strings.TrimSpace(string(exitErr.Stderr))
			if stderr != "" {
				return nil, fmt.Errorf("yt-dlp metadata fetch failed: %w: %s", err, stderr)
			}
		}
		return nil, fmt.Errorf("yt-dlp metadata fetch failed: %w", err)
	}

	var metadata MediaMetadata
	if err := json.Unmarshal(output, &metadata); err != nil {
		return nil, err
	}
	if err := validateMediaDurationSeconds(metadata.Duration, c.MaxDurationSecs); err != nil {
		return nil, err
	}

	metadata = removeMixedFormats(metadata)

	return &metadata, nil
}
