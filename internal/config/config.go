package config

import (
	"fmt"
	"os"
	"time"
)

type Config struct {
	Server   ServerConfig
	LogLevel string
}

type ServerConfig struct {
	AppName         string
	Addr            string
	ShutdownTimeout time.Duration
}

func Load() (*Config, error) {
	appName := getEnv("APP_NAME", "Nodus")
	addr := getEnv("ADDR", ":8888")
	shutdownTimeout := getEnv("SHUTDOWN_TIMEOUT", "30s")
	logLevel := getEnv("LOG_LEVEL", "info")

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

func (c *Config) Validate() error {
	if c.Server.Addr == "" {
		return fmt.Errorf("server addr is empty")
	}

	if c.Server.ShutdownTimeout <= 0 {
		return fmt.Errorf("server shutdown timeout must be greater than 0")
	}

	switch c.LogLevel {
	case "debug", "info", "warn", "error":
	default:
		return fmt.Errorf("invalid LOG_LEVEL: %s", c.LogLevel)
	}

	return nil
}
