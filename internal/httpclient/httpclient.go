package httpclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Options struct {
	Method          string
	URL             string
	RequestHeaders  *http.Header
	Input           any
	Output          any
	ResponseHeaders *http.Header
}

type Client struct {
	httpClient *http.Client
}

func New(timeout time.Duration) *Client {
	return &Client{
		httpClient: &http.Client{Timeout: timeout},
	}
}

func (c *Client) DoRequest(ctx context.Context, options Options) error {
	var body io.Reader
	if options.Input != nil {
		b, err := json.Marshal(options.Input)
		if err != nil {
			return fmt.Errorf("failed to marshal input: %w", err)
		}
		body = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, options.Method, options.URL, body)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	if options.RequestHeaders != nil {
		for key, values := range *options.RequestHeaders {
			for _, value := range values {
				req.Header.Add(key, value)
			}
		}
	}
	if req.Header.Get("Accept") == "" {
		req.Header.Set("Accept", "application/json")
	}
	if options.Input != nil && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		responseBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(responseBody))
	}

	if options.Output != nil {
		if err := json.NewDecoder(resp.Body).Decode(options.Output); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
	}

	if options.ResponseHeaders != nil {
		if *options.ResponseHeaders == nil {
			*options.ResponseHeaders = make(http.Header)
		}
		for key, values := range resp.Header {
			for _, value := range values {
				options.ResponseHeaders.Add(key, value)
			}
		}
	}

	return nil
}
