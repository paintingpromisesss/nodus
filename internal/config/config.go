package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	TelegramBotToken                    string
	TelegramBotAPIURL                   string
	CobaltBaseURL                       string
	MaxFileBytes                        int64
	DBPath                              string
	TempDir                             string
	RequestTimeout                      time.Duration
	DownloadTimeout                     time.Duration
	FFprobeTimeout                      time.Duration
	FFmpegTimeout                       time.Duration
	PickerSessionManagerTTL             time.Duration
	PickerSessionManagerCleanupInterval time.Duration
	LogLevel                            string
}

func Load() (Config, error) {
	cfg := Config{
		TelegramBotToken:  strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN")),
		TelegramBotAPIURL: strings.TrimSpace(getEnvDefault("TELEGRAM_BOT_API_URL", "http://telegram-bot-api:8081")),
		CobaltBaseURL:     getEnvDefault("COBALT_BASE_URL", "http://cobalt:9000/"),
		DBPath:            getEnvDefault("DB_PATH", "./data/bot.db"),
		TempDir:           getEnvDefault("TEMP_DIR", "./tmp"),
		LogLevel:          strings.ToLower(getEnvDefault("LOG_LEVEL", "info")),
	}

	if cfg.TelegramBotToken == "" {
		return Config{}, errors.New("TELEGRAM_BOT_TOKEN is required")
	}

	maxBytesRaw := strings.TrimSpace(os.Getenv("MAX_FILE_BYTES"))
	if maxBytesRaw == "" {
		return Config{}, errors.New("MAX_FILE_BYTES is required")
	} else {
		maxBytes, err := strconv.ParseInt(maxBytesRaw, 10, 64)
		if err != nil || maxBytes <= 0 {
			return Config{}, fmt.Errorf("MAX_FILE_BYTES must be a positive integer, got %q", maxBytesRaw)
		} else {
			cfg.MaxFileBytes = maxBytes
		}
	}

	requestTimeoutRaw := strings.TrimSpace(getEnvDefault("REQUEST_TIMEOUT", "30s"))
	requestTimeout, err := time.ParseDuration(requestTimeoutRaw)
	if err != nil || requestTimeout <= 0 {
		return Config{}, fmt.Errorf("REQUEST_TIMEOUT must be a positive duration, got %q", requestTimeoutRaw)
	} else {
		cfg.RequestTimeout = requestTimeout
	}

	downloadTimeoutRaw := strings.TrimSpace(getEnvDefault("DOWNLOAD_TIMEOUT", "10m"))
	downloadTimeout, err := time.ParseDuration(downloadTimeoutRaw)
	if err != nil || downloadTimeout <= 0 {
		return Config{}, fmt.Errorf("DOWNLOAD_TIMEOUT must be a positive duration, got %q", downloadTimeoutRaw)
	} else {
		cfg.DownloadTimeout = downloadTimeout
	}

	ffprobeTimeoutRaw := strings.TrimSpace(getEnvDefault("FFPROBE_TIMEOUT", "5s"))
	ffprobeTimeout, err := time.ParseDuration(ffprobeTimeoutRaw)
	if err != nil || ffprobeTimeout <= 0 {
		return Config{}, fmt.Errorf("FFPROBE_TIMEOUT must be a positive duration, got %q", ffprobeTimeoutRaw)
	} else {
		cfg.FFprobeTimeout = ffprobeTimeout
	}

	ffmpegTimeoutRaw := strings.TrimSpace(getEnvDefault("FFMPEG_TIMEOUT", "30s"))
	ffmpegTimeout, err := time.ParseDuration(ffmpegTimeoutRaw)
	if err != nil || ffmpegTimeout <= 0 {
		return Config{}, fmt.Errorf("FFMPEG_TIMEOUT must be a positive duration, got %q", ffmpegTimeoutRaw)
	} else {
		cfg.FFmpegTimeout = ffmpegTimeout
	}

	pickerSessionManangerTTLRaw := strings.TrimSpace(getEnvDefault("PICKER_SESSION_MANAGER_TTL", "10m"))
	pickerSessionManagerTTL, err := time.ParseDuration(pickerSessionManangerTTLRaw)
	if err != nil || pickerSessionManagerTTL <= 0 {
		return Config{}, fmt.Errorf("PICKER_SESSION_MANAGER_TTL must be a positive duration, got %q", pickerSessionManangerTTLRaw)
	} else {
		cfg.PickerSessionManagerTTL = pickerSessionManagerTTL
	}

	pickerSessionManangerCleanupIntervalRaw := strings.TrimSpace(getEnvDefault("PICKER_SESSION_MANAGER_CLEANUP_INTERVAL", "3m"))
	pickerSessionManagerCleanupInterval, err := time.ParseDuration(pickerSessionManangerCleanupIntervalRaw)
	if err != nil || pickerSessionManagerCleanupInterval <= 0 {
		return Config{}, fmt.Errorf("PICKER_SESSION_MANAGER_CLEANUP_INTERVAL must be a positive duration, got %q", pickerSessionManangerCleanupIntervalRaw)
	} else {
		cfg.PickerSessionManagerCleanupInterval = pickerSessionManagerCleanupInterval
	}

	return cfg, nil
}

func getEnvDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
