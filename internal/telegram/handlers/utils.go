package handlers

import (
	"errors"
	"go.uber.org/zap"
	"os"
)

func formatAvailableServices(services []string) string {
	result := ""
	for i, service := range services {
		result += service
		if i != len(services)-1 {
			result += ", "
		}
	}
	return result
}

func cleanupTempFile(log *zap.Logger, filePath string) {
	if filePath == "" {
		return
	}
	if err := os.Remove(filePath); err != nil && !errors.Is(err, os.ErrNotExist) {
		log.Warn("failed to remove temp file", zap.String("path", filePath), zap.Error(err))
	}
}
