package ytdlp

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func detectJSRuntimeSpec(enabled bool) string {
	if !enabled {
		return ""
	}

	candidates := []struct {
		runtime string
		binary  string
	}{
		{runtime: "node", binary: "node"},
		{runtime: "node", binary: "nodejs"},
		{runtime: "bun", binary: "bun"},
		{runtime: "deno", binary: "deno"},
	}

	for _, candidate := range candidates {
		path, err := exec.LookPath(candidate.binary)
		if err == nil && strings.TrimSpace(path) != "" {
			return candidate.runtime + ":" + path
		}
	}

	return ""
}

func normalizeTempDir(tempDir string) string {
	trimmed := strings.TrimSpace(tempDir)
	if trimmed == "" {
		return ""
	}

	absolutePath, err := filepath.Abs(trimmed)
	if err != nil {
		return trimmed
	}

	return absolutePath
}

func (c *Client) buildFetchMetadataArgs(url string, useAllClients bool) []string {
	args := []string{"-J", "--skip-download"}
	args = appendJSRuntimeArgs(args, c.JSRuntimeSpec)

	if !c.PlaylistAvailable {
		args = append(args, "--no-playlist")
	}

	if c.MaxDurationSecs > 0 {
		if !c.CurrentlyLiveAvailable {
			args = append(args, "--match-filter", "duration <= "+fmt.Sprint(c.MaxDurationSecs)+" & !is_live")
		} else {
			args = append(args, "--match-filter", "duration <= "+fmt.Sprint(c.MaxDurationSecs))
		}
	}

	if c.MaxFileBytes > 0 {
		args = append(args, "--max-filesize", fmt.Sprint(c.MaxFileBytes))
	}

	if useAllClients {
		args = append(args, "--extractor-args", "youtube:player_client=all")
	}

	args = append(args, url)

	return args
}

func (c *Client) prepareRuntimeDirectories() error {
	if strings.TrimSpace(c.tempDir) == "" {
		return nil
	}

	directories := []string{
		c.tempDir,
		filepath.Join(c.tempDir, ".home"),
		filepath.Join(c.tempDir, ".cache"),
		filepath.Join(c.tempDir, ".parts"),
	}

	for _, directory := range directories {
		if err := os.MkdirAll(directory, 0o755); err != nil {
			return fmt.Errorf("create yt-dlp runtime directory %s: %w", directory, err)
		}
	}

	return nil
}

func (c *Client) defaultEnvironment() []string {
	env := os.Environ()

	if strings.TrimSpace(c.tempDir) == "" {
		return env
	}

	env = setEnvironmentValue(env, "HOME", filepath.Join(c.tempDir, ".home"))
	env = setEnvironmentValue(env, "XDG_CACHE_HOME", filepath.Join(c.tempDir, ".cache"))
	env = setEnvironmentValue(env, "TMPDIR", c.tempDir)
	env = setEnvironmentValue(env, "TEMP", c.tempDir)
	env = setEnvironmentValue(env, "TMP", c.tempDir)

	return env
}

func setEnvironmentValue(environment []string, key, value string) []string {
	prefix := key + "="
	filtered := make([]string, 0, len(environment)+1)

	for _, entry := range environment {
		if strings.HasPrefix(entry, prefix) {
			continue
		}
		filtered = append(filtered, entry)
	}

	return append(filtered, prefix+value)
}

func appendJSRuntimeArgs(args []string, runtimeSpec string) []string {
	runtimeSpec = strings.TrimSpace(runtimeSpec)
	if runtimeSpec == "" {
		return args
	}

	return append(args, "--js-runtimes", runtimeSpec)
}

func validateMediaDurationSeconds(actualSeconds, maxSeconds int) error {
	if maxSeconds <= 0 || actualSeconds <= 0 {
		return nil
	}
	if actualSeconds > maxSeconds {
		return fmt.Errorf("%w: got %ds, max %ds", ErrMediaDurationTooLong, actualSeconds, maxSeconds)
	}
	return nil
}

func (c *Client) buildDownloadArgs(url string, formatID string) []string {
	args := []string{
		"-f", formatID,
		"-P", "temp:" + filepath.Join(c.tempDir, ".parts"),
		"-o", filepath.Join(c.tempDir, "%(title)s [%(id)s] [%(format_id)s].%(ext)s"),
		"--print", "after_move:filepath",
	}
	args = appendJSRuntimeArgs(args, c.JSRuntimeSpec)

	if !c.PlaylistAvailable {
		args = append(args, "--no-playlist")
	}

	if strings.Contains(formatID, "+") {
		args = append(args, "--merge-output-format", "mp4")
	}

	if c.MaxDurationSecs > 0 {
		if !c.CurrentlyLiveAvailable {
			args = append(args, "--match-filter", "duration <= "+fmt.Sprint(c.MaxDurationSecs)+" & !is_live")
		} else {
			args = append(args, "--match-filter", "duration <= "+fmt.Sprint(c.MaxDurationSecs))
		}
	}

	if c.MaxFileBytes > 0 {
		args = append(args, "--max-filesize", fmt.Sprint(c.MaxFileBytes))
	}

	args = append(args, url)

	return args
}

func parseDownloadedFilePathBytes(output []byte) (string, error) {
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line == "" {
			continue
		}
		return filepath.Clean(line), nil
	}
	return "", fmt.Errorf("yt-dlp did not return downloaded filepath")
}
