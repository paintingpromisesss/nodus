package main

import (
	"context"
	"fmt"

	"github.com/paintingpromisesss/cobalt_bot/internal/config"
	repository "github.com/paintingpromisesss/cobalt_bot/internal/infrastructure/repository/sqlite"
	storage "github.com/paintingpromisesss/cobalt_bot/internal/infrastructure/storage/sqlite"
	zapLogger "github.com/paintingpromisesss/cobalt_bot/internal/logger"
	"github.com/paintingpromisesss/cobalt_bot/internal/service"
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

	sqliteDB, err := storage.New(cfg.DBPath)
	if err != nil {
		logger.Fatal("db init failed", zap.Error(err), zap.String("db_path", cfg.DBPath))
	}
	defer func() {
		if closeErr := sqliteDB.Close(); closeErr != nil {
			logger.Warn("db close failed", zap.Error(closeErr))
		}
	}()

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

	logger.Info("sqlite initialized", zap.String("db_path", cfg.DBPath))

	settingsRepo, err := repository.NewUserSettingsRepository(sqliteDB.SQL())
	if err != nil {
		logger.Fatal("settings repository init failed", zap.Error(err))
	}

	settingsService, err := service.NewUserSettingsService(settingsRepo)
	if err != nil {
		logger.Fatal("settings service init failed", zap.Error(err))
	}

	defaultSettings, err := settingsService.GetByUserID(context.Background(), 0)
	if err != nil {
		logger.Fatal("settings service smoke check failed", zap.Error(err))
	}
	logger.Info("settings service initialized", zap.Any("default_user_settings", defaultSettings))
}
