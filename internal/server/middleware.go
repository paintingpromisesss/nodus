package server

import (
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
)

func (s *Server) registerMiddleware() {
	s.app.Use(recover.New())
	s.app.Use(logger.New())
}
