package bootstrap

import (
	"context"
	"fmt"

	"github.com/paintingpromisesss/cobalt_bot/internal/cobalt"
	"github.com/paintingpromisesss/cobalt_bot/internal/config"
	"github.com/paintingpromisesss/cobalt_bot/internal/downloader"
	"github.com/paintingpromisesss/cobalt_bot/internal/logger"
	"github.com/paintingpromisesss/cobalt_bot/internal/queue"
	"github.com/paintingpromisesss/cobalt_bot/internal/storage"
	"github.com/paintingpromisesss/cobalt_bot/internal/telegram"
	"github.com/paintingpromisesss/cobalt_bot/internal/telegram/handlers"
	pickersession "github.com/paintingpromisesss/cobalt_bot/internal/telegram/picker_session"
	"github.com/paintingpromisesss/cobalt_bot/internal/telegram/sender"
	"github.com/paintingpromisesss/cobalt_bot/internal/urlvalidator"
	"github.com/paintingpromisesss/cobalt_bot/internal/ytdlp"
	"go.uber.org/zap"
)

type Container struct {
	Logger  *zap.Logger
	Storage *storage.DB
	Bot     *telegram.Bot
	Handler *handlers.Handler
}

func Build(ctx context.Context, cfg config.Config) (*Container, error) {
	log, err := logger.New(cfg.Logging.Level)
	if err != nil {
		return nil, fmt.Errorf("init logger: %w", err)
	}

	db, err := storage.New(cfg.Storage.DBPath)
	if err != nil {
		_ = log.Sync()
		return nil, fmt.Errorf("init db: %w", err)
	}

	tgBot, err := telegram.New(cfg.Telegram.BotToken, cfg.Telegram.BotAPIURL, cfg.Timeouts.TelegramSend, log)
	if err != nil {
		_ = db.Close()
		_ = log.Sync()
		return nil, fmt.Errorf("init telegram bot: %w", err)
	}

	queueManager := queue.NewRequestQueue()
	cobaltClient := cobalt.NewCobaltClient(cfg.Cobalt.BaseURL, cfg.Timeouts.Request)
	fileDownloader := downloader.NewDownloader(cfg.Timeouts.Download, cfg.Storage.TempDir, cfg.Storage.MaxFileBytes)
	ytDLPClient := ytdlp.NewClient(
		cfg.Storage.TempDir,
		cfg.YTDLP.MaxMediaDurationSeconds,
		cfg.Storage.MaxFileBytes,
		cfg.YTDLP.CurrentlyLiveAvailable,
		cfg.YTDLP.PlaylistAvailable,
	)
	fileSender := sender.NewFileSender(log, cfg.Timeouts.FFprobe, cfg.Timeouts.FFmpeg)

	instanceInfo, err := cobaltClient.GetInstanceInfo(ctx)
	if err != nil {
		_ = db.Close()
		_ = log.Sync()
		return nil, fmt.Errorf("get instance info: %w", err)
	}

	availableServices := instanceInfo.Cobalt.Services
	urlValidator := urlvalidator.NewURLValidator(availableServices)
	pickerSessionManager := pickersession.NewPickerSessionManager(ctx, cfg.PickerSession.TTL, cfg.PickerSession.CleanupInterval)

	handler := handlers.NewHandler(
		ctx,
		cfg.Timeouts.Request,
		cfg.Timeouts.Download,
		cfg.YTDLP.MaxMediaDurationSeconds,
		tgBot,
		db,
		queueManager,
		log,
		cobaltClient,
		fileDownloader,
		ytDLPClient,
		urlValidator,
		fileSender,
		availableServices,
		pickerSessionManager,
	)

	return &Container{
		Logger:  log,
		Storage: db,
		Bot:     tgBot,
		Handler: handler,
	}, nil
}
