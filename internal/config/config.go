package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Server   ServerConfig
	YTDLP    YTDLPConfig
	LogLevel string
}

type ServerConfig struct {
	AppName         string
	Addr            string
	ShutdownTimeout time.Duration
}

type YTDLPConfig struct {
	TempDir                string
	MaxDurationSecs        int
	MaxFileBytes           int64
	CurrentlyLiveAvailable bool
	PlaylistAvailable      bool
	UseJSRuntime           bool
}

func Load() (*Config, error) {
	appName := getEnv("APP_NAME", "Nodus")
	addr := getEnv("ADDR", ":8888")
	shutdownTimeout := getEnv("SHUTDOWN_TIMEOUT", "30s")
	logLevel := getEnv("LOG_LEVEL", "info")
	ytdlpTempDir := getEnv("YTDLP_TEMP_DIR", "./tmp/ytdlp")
	ytdlpMaxDurationSecs := getEnvInt("YTDLP_MAX_DURATION_SECS", 0)
	ytdlpMaxFileBytes := getEnvInt64("YTDLP_MAX_FILE_BYTES", 0)
	ytdlpCurrentlyLiveAvailable := getEnvBool("YTDLP_CURRENTLY_LIVE_AVAILABLE", false)
	ytdlpPlaylistAvailable := getEnvBool("YTDLP_PLAYLIST_AVAILABLE", true)
	ytdlpUseJSRuntime := getEnvBool("YTDLP_USE_JS_RUNTIME", true)

	ShutdownTimeoutDuration, err := time.ParseDuration(shutdownTimeout)
	if err != nil {
		return nil, fmt.Errorf("parse SHUTDOWN_TIMEOUT: %w", err)
	}

	cfg := &Config{
		Server: ServerConfig{
			AppName:         appName,
			Addr:            addr,
			ShutdownTimeout: ShutdownTimeoutDuration,
		},
		YTDLP: YTDLPConfig{
			TempDir:                ytdlpTempDir,
			MaxDurationSecs:        ytdlpMaxDurationSecs,
			MaxFileBytes:           ytdlpMaxFileBytes,
			CurrentlyLiveAvailable: ytdlpCurrentlyLiveAvailable,
			PlaylistAvailable:      ytdlpPlaylistAvailable,
			UseJSRuntime:           ytdlpUseJSRuntime,
		},
		LogLevel: logLevel,
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func getEnvInt64(key string, fallback int64) int64 {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}

	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func (c *Config) Validate() error {
	if c.Server.Addr == "" {
		return fmt.Errorf("server addr is empty")
	}

	if c.Server.ShutdownTimeout <= 0 {
		return fmt.Errorf("server shutdown timeout must be greater than 0")
	}

	if c.YTDLP.TempDir == "" {
		return fmt.Errorf("ytdlp temp dir is empty")
	}

	switch c.LogLevel {
	case "debug", "info", "warn", "error":
	default:
		return fmt.Errorf("invalid LOG_LEVEL: %s", c.LogLevel)
	}

	return nil
}
