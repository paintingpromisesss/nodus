package server

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v3"
	"github.com/paintingpromisesss/nodus-backend/internal/config"
	"github.com/paintingpromisesss/nodus-backend/internal/ytdlp"
	"go.uber.org/zap"
)

type Server struct {
	app    *fiber.App
	config config.ServerConfig
	logger *zap.Logger
	ytdlp  *ytdlp.Client
}

func New(cfg config.ServerConfig, logger *zap.Logger, ytdlpClient *ytdlp.Client) *Server {
	app := fiber.New(fiber.Config{
		AppName: cfg.AppName,
	})

	s := &Server{
		app:    app,
		config: cfg,
		logger: logger,
		ytdlp:  ytdlpClient,
	}

	s.registerMiddleware()
	s.registerRoutes()

	return s
}

func (s *Server) Run(ctx context.Context) error {
	serverErrCh := make(chan error, 1)

	go func() {
		s.logger.Info("Starting server", zap.String("addr", s.config.Addr))
		if err := s.app.Listen(s.config.Addr); err != nil {
			serverErrCh <- err
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(sigCh)

	select {
	case err := <-serverErrCh:
		return err
	case sig := <-sigCh:
		s.logger.Info("Received signal", zap.String("signal", sig.String()))
	case <-ctx.Done():
		s.logger.Info("Shutdown requested", zap.Error(ctx.Err()))
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), s.config.ShutdownTimeout)
	defer cancel()

	if err := s.app.ShutdownWithContext(shutdownCtx); err != nil {
		return err
	}

	s.logger.Info("Server gracefully stopped")
	return nil
}
