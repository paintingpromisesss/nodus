package main

import (
	"context"
	"log"

	"github.com/paintingpromisesss/nodus-backend/internal/config"
	"github.com/paintingpromisesss/nodus-backend/internal/logger"
	"github.com/paintingpromisesss/nodus-backend/internal/server"
)

func main() {
	config, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	logger, err := logger.New(config.LogLevel)
	if err != nil {
		log.Fatalf("Failed to create logger: %v", err)
	}

	srv := server.New(config.Server, logger)

	if err := srv.Run(context.Background()); err != nil {
		log.Fatal(err)
	}

}
