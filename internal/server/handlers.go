package server

import "github.com/gofiber/fiber/v3"

func (s *Server) handleHealth(c fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status": "ok",
	})
}
