package server

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v3"
)

func writeSSE(writer *bufio.Writer, event string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal sse payload: %w", err)
	}

	if _, err := writer.WriteString("event: " + event + "\n"); err != nil {
		return err
	}

	if _, err := writer.WriteString("data: " + string(data) + "\n\n"); err != nil {
		return err
	}

	return writer.Flush()
}

func RespondWithError(c fiber.Ctx, status int, err error) error {
	return c.Status(status).JSON(fiber.Map{
		"error": err.Error(),
	})
}

func RespondWithJSON(c fiber.Ctx, status int, payload any) error {
	return c.Status(status).JSON(payload)
}

func setSSEMetadataHeaders(c fiber.Ctx) {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")
	c.Set("X-Accel-Buffering", "no")
}

func setDownloadHeaders(c fiber.Ctx, filename string, contentType string, contentLength int64) {
	c.Set("Content-Type", contentType)
	c.Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	c.Set("Content-Length", fmt.Sprintf("%d", contentLength))
	c.Set("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, Content-Type")
}

func sanitizeAttachmentFilename(name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	if name == "." || name == "" {
		return "download.bin"
	}

	replacer := strings.NewReplacer(
		"\r", "_",
		"\n", "_",
		"\"", "_",
		"\\", "_",
		"/", "_",
	)

	name = replacer.Replace(name)
	if strings.TrimSpace(name) == "" {
		return "download.bin"
	}

	return name
}

func removeFileQuietly(path string) {
	if strings.TrimSpace(path) == "" {
		return
	}
	_ = os.Remove(path)
}
