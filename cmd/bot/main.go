package main

import (
	"fmt"

	"github.com/paintingpromisesss/cobalt_bot/internal/config"
	zapLogger "github.com/paintingpromisesss/cobalt_bot/internal/logger"
	"go.uber.org/zap"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic(fmt.Sprintf("config error: %v", err))
	}

	logger, err := zapLogger.New(cfg.LogLevel)
	if err != nil {
		panic(fmt.Sprintf("logger init error: %v", err))
	}
	defer func() { _ = logger.Sync() }()

	logger.Info(
		"config loaded",
		zap.String("cobalt_base_url", cfg.CobaltBaseURL),
		zap.String("mihomo_base_url", cfg.MihomoBaseURL),
		zap.Int64("max_file_bytes", cfg.MaxFileBytes),
		zap.String("db_path", cfg.DBPath),
		zap.String("temp_dir", cfg.TempDir),
		zap.Duration("request_timeout", cfg.RequestTimeout),
		zap.Duration("download_timeout", cfg.DownloadTimeout),
		zap.String("log_level", cfg.LogLevel),
	)
}
