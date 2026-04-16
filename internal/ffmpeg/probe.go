package ffmpeg

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

type ProbeResult struct {
	VideoCodec string
	AudioCodec string
}

type ffprobeOutput struct {
	Streams []ffprobeStream `json:"streams"`
}

type ffprobeStream struct {
	CodecName string `json:"codec_name"`
	CodecType string `json:"codec_type"`
}

func (c *Client) ProbeCodecs(ctx context.Context, inputPath string) (*ProbeResult, error) {
	args := []string{
		"-v", "error",
		"-show_entries", "stream=codec_name,codec_type",
		"-of", "json",
		inputPath,
	}

	cmd := exec.CommandContext(ctx, "ffprobe", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("ffprobe failed: %w: %s", err, strings.TrimSpace(string(output)))
	}

	var parsed ffprobeOutput
	if err := json.Unmarshal(output, &parsed); err != nil {
		return nil, fmt.Errorf("decode ffprobe output: %w", err)
	}

	result := &ProbeResult{}
	for _, stream := range parsed.Streams {
		switch stream.CodecType {
		case "video":
			if result.VideoCodec == "" {
				result.VideoCodec = strings.TrimSpace(stream.CodecName)
			}
		case "audio":
			if result.AudioCodec == "" {
				result.AudioCodec = strings.TrimSpace(stream.CodecName)
			}
		}
	}

	return result, nil
}
