package logger

import (
	"fmt"

	"go.uber.org/zap"
)

func New(level string) (*zap.Logger, error) {
	var atom zap.AtomicLevel
	switch level {
	case "debug":
		atom = zap.NewAtomicLevelAt(zap.DebugLevel)
	case "info", "":
		atom = zap.NewAtomicLevelAt(zap.InfoLevel)
	case "warn", "warning":
		atom = zap.NewAtomicLevelAt(zap.WarnLevel)
	case "error":
		atom = zap.NewAtomicLevelAt(zap.ErrorLevel)
	default:
		return nil, fmt.Errorf("unsupported LOG_LEVEL %q, allowed: debug, info, warn, error", level)
	}

	logger, err := zap.NewProduction(zap.IncreaseLevel(atom))
	if err != nil {
		return nil, fmt.Errorf("failed to create logger: %w", err)
	}
	defer logger.Sync()

	sugar := logger.Sugar()
	sugar.Infow("Logger initialized", "level", level)

	return logger, nil
}
