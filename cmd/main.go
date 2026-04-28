package main

import (
	"context"
	"log"

	"github.com/paintingpromisesss/nodus/internal/config"
	"github.com/paintingpromisesss/nodus/internal/ffmpeg"
	"github.com/paintingpromisesss/nodus/internal/logger"
	"github.com/paintingpromisesss/nodus/internal/server"
	"github.com/paintingpromisesss/nodus/internal/ytdlp"
)

func main() {
	config, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	if err := config.Validate(); err != nil {
		log.Fatalf("Invalid config: %v", err)
	}
	logger, err := logger.New(config.LogLevel)
	if err != nil {
		log.Fatalf("Failed to create logger: %v", err)
	}

	ffmpegClient := ffmpeg.NewClient()

	ytdlpClient := ytdlp.NewClient(
		config.YTDLP.TempDir,
		config.YTDLP.MaxDurationSecs,
		config.YTDLP.MaxFileBytes,
		config.YTDLP.CurrentlyLiveAvailable,
		config.YTDLP.PlaylistAvailable,
		config.YTDLP.UseJSRuntime,
		ffmpegClient,
	)

	srv := server.New(config.Server, logger, ytdlpClient)

	if err := srv.Run(context.Background()); err != nil {
		log.Fatal(err)
	}

}
