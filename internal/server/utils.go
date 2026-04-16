package server

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/url"
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
	c.Set("Content-Disposition", buildContentDisposition(filename))
	c.Set("Content-Length", fmt.Sprintf("%d", contentLength))
	c.Set("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, Content-Type")
}

func buildContentDisposition(filename string) string {
	fallback := buildASCIIFilenameFallback(filename)
	encoded := url.PathEscape(filename)
	return `attachment; filename="` + fallback + `"; filename*=UTF-8''` + encoded
}

func buildASCIIFilenameFallback(filename string) string {
	var builder strings.Builder
	builder.Grow(len(filename))

	for _, r := range filename {
		if transliterated, ok := cyrillicFilenameFallback[r]; ok {
			builder.WriteString(transliterated)
			continue
		}

		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			builder.WriteRune(r)
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
		case strings.ContainsRune("!#$&+-.^_`|~()[]{}", r):
			builder.WriteRune(r)
		default:
			builder.WriteByte('_')
		}
	}

	fallback := builder.String()
	if strings.Trim(fallback, "_.") == "" {
		return "download.bin"
	}

	return fallback
}

var cyrillicFilenameFallback = map[rune]string{
	'А': "A", 'а': "a",
	'Б': "B", 'б': "b",
	'В': "V", 'в': "v",
	'Г': "G", 'г': "g",
	'Д': "D", 'д': "d",
	'Е': "E", 'е': "e",
	'Ё': "Yo", 'ё': "yo",
	'Ж': "Zh", 'ж': "zh",
	'З': "Z", 'з': "z",
	'И': "I", 'и': "i",
	'Й': "Y", 'й': "y",
	'К': "K", 'к': "k",
	'Л': "L", 'л': "l",
	'М': "M", 'м': "m",
	'Н': "N", 'н': "n",
	'О': "O", 'о': "o",
	'П': "P", 'п': "p",
	'Р': "R", 'р': "r",
	'С': "S", 'с': "s",
	'Т': "T", 'т': "t",
	'У': "U", 'у': "u",
	'Ф': "F", 'ф': "f",
	'Х': "Kh", 'х': "kh",
	'Ц': "Ts", 'ц': "ts",
	'Ч': "Ch", 'ч': "ch",
	'Ш': "Sh", 'ш': "sh",
	'Щ': "Sch", 'щ': "sch",
	'Ъ': "", 'ъ': "",
	'Ы': "Y", 'ы': "y",
	'Ь': "", 'ь': "",
	'Э': "E", 'э': "e",
	'Ю': "Yu", 'ю': "yu",
	'Я': "Ya", 'я': "ya",
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
