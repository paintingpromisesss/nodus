package sender

import (
	"errors"
	"fmt"
	"strings"

	tele "gopkg.in/telebot.v4"
)

type FileSender struct{}

func NewFileSender() *FileSender {
	return &FileSender{}
}

func (s *FileSender) SendFile(c tele.Context, filePath, fileName, detectedMIME string, statusMsg *tele.Message) error {
	if c == nil {
		return errors.New("telegram context is nil")
	}
	if strings.TrimSpace(filePath) == "" {
		return errors.New("file path is required")
	}
	if strings.TrimSpace(fileName) == "" {
		return errors.New("file name is required")
	}

	if _, err := c.Bot().Edit(statusMsg, buildMedia(filePath, fileName, detectedMIME)); err != nil {
		return fmt.Errorf("send file to telegram: %w", err)
	}

	return nil
}

func buildMedia(filePath, fileName, detectedMIME string) any {
	file := tele.FromDisk(filePath)
	mime := strings.TrimSpace(strings.ToLower(detectedMIME))

	switch {
	case strings.HasPrefix(mime, "image/"):
		return &tele.Photo{
			File: file,
		}
	case strings.HasPrefix(mime, "video/"):
		return &tele.Video{
			File:      file,
			FileName:  fileName,
			MIME:      detectedMIME,
			Streaming: true,
		}
	case strings.HasPrefix(mime, "audio/"):
		return &tele.Audio{
			File:     file,
			FileName: fileName,
			MIME:     detectedMIME,
		}
	default:
		return &tele.Document{
			File:     file,
			FileName: fileName,
			MIME:     detectedMIME,
		}
	}
}
