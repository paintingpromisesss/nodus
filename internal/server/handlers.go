package server

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"

	"github.com/gofiber/fiber/v3"
	"github.com/paintingpromisesss/nodus-backend/internal/server/dto"
	"github.com/paintingpromisesss/nodus-backend/internal/ytdlp"
)

func (s *Server) handleHealth(c fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status": "ok",
	})
}

func (s *Server) handleFetchMetadataStream(c fiber.Ctx) error {
	if s.ytdlp == nil {
		return RespondWithError(c, fiber.StatusInternalServerError, ErrYtdlpClientNotConfigured)
	}

	var request dto.FetchMetadataStreamRequest
	if err := json.Unmarshal(c.Body(), &request); err != nil {
		return RespondWithError(c, fiber.StatusBadRequest, ErrInvalidRequestBody)
	}

	if len(request.URLs) == 0 {
		return RespondWithError(c, fiber.StatusBadRequest, ErrUrlsRequired)
	}

	setSSEMetadataHeaders(c)

	streamCtx := c.Context()

	return c.SendStreamWriter(func(writer *bufio.Writer) {
		s.streamMetadataSSE(streamCtx, writer, request)
	})
}

func (s *Server) handleDownload(c fiber.Ctx) error {
	if s.ytdlp == nil {
		return RespondWithError(c, fiber.StatusInternalServerError, ErrYtdlpClientNotConfigured)
	}

	var request dto.DownloadRequest
	if err := json.Unmarshal(c.Body(), &request); err != nil {
		return RespondWithError(c, fiber.StatusBadRequest, ErrInvalidRequestBody)
	}

	if request.URL == "" {
		return RespondWithError(c, fiber.StatusBadRequest, ErrURLRequired)
	}
	if request.FormatID == "" {
		return RespondWithError(c, fiber.StatusBadRequest, ErrFormatIDRequired)
	}

	downloadOptions := ytdlp.DownloadOptions{
		FormatID: request.FormatID,
	}
	if request.DownloadOptions != nil {
		downloadOptions.ACodec = request.DownloadOptions.ACodec
		downloadOptions.VCodec = request.DownloadOptions.VCodec
		downloadOptions.Container = request.DownloadOptions.Container
	}

	result, err := s.ytdlp.Download(c.Context(), request.URL, downloadOptions)
	if err != nil {
		return RespondWithError(c, fiber.StatusBadRequest, err)
	}
	filePath := result.FilePath
	defer func() {
		if filePath != "" {
			removeFileQuietly(filePath)
		}
	}()

	file, err := os.Open(result.FilePath)
	if err != nil {
		return RespondWithError(c, fiber.StatusInternalServerError, err)
	}

	defer func() {
		if file != nil {
			_ = file.Close()
		}
	}()

	info, err := file.Stat()
	if err != nil {
		return RespondWithError(c, fiber.StatusInternalServerError, err)
	}

	filename := sanitizeAttachmentFilename(result.Filename)
	contentType := result.DetectedMIME
	if contentType == "" {
		contentType = result.ContentType
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	setDownloadHeaders(c, filename, contentType, info.Size())

	streamFile := file
	streamPath := filePath
	file = nil
	filePath = ""

	return c.SendStreamWriter(func(writer *bufio.Writer) {
		defer func() {
			_ = streamFile.Close()
		}()
		defer removeFileQuietly(streamPath)

		_, _ = io.Copy(writer, streamFile)
		_ = writer.Flush()
	})
}

func (s *Server) streamMetadataSSE(
	streamCtx context.Context,
	writer *bufio.Writer,
	request dto.FetchMetadataStreamRequest,
) {
	streamCtx, cancel := context.WithCancel(streamCtx)
	defer cancel()

	var writeErr error

	writeErr = writeSSE(writer, "ready", map[string]any{
		"total": len(request.URLs),
	})
	if writeErr != nil {
		return
	}

	err := s.ytdlp.StreamMetadata(
		streamCtx,
		request.URLs,
		ytdlp.FetchOptions(request.FetchOptions),
		func(event ytdlp.MetadataEvent) {
			if writeErr != nil {
				return
			}

			payload := map[string]any{
				"index": event.Index,
				"url":   event.URL,
			}

			if event.Err != nil {
				payload["error"] = event.Err.Error()
				writeErr = writeSSE(writer, "error", payload)
			} else {
				payload["data"] = event.Data
				writeErr = writeSSE(writer, "item", payload)
			}

			if writeErr != nil {
				cancel()
			}
		},
	)

	if writeErr != nil {
		return
	}

	if err != nil && !errors.Is(err, context.Canceled) {
		_ = writeSSE(writer, "fatal", map[string]any{
			"error": err.Error(),
		})
		return
	}

	_ = writeSSE(writer, "done", map[string]any{
		"total": len(request.URLs),
	})
}
