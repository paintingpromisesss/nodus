package urlvalidator

import (
	"context"
	"net/url"
	"strings"
	"time"

	"github.com/paintingpromisesss/cobalt_bot/internal/httpclient"
)

type URLValidator struct {
	httpClient *httpclient.Client
}

func NewURLValidator(timeout time.Duration) *URLValidator {
	return &URLValidator{
		httpClient: httpclient.New(timeout),
	}
}

func (v *URLValidator) Validate(raw string) (string, bool) {
	value := strings.TrimSpace(raw)
	if value == "" || v == nil || v.httpClient == nil {
		return "", false
	}
	if strings.ContainsAny(value, " \t\r\n") {
		return "", false
	}

	candidates := buildURLCandidates(value)
	for _, candidate := range candidates {
		if v.probeURLWithGET(candidate) {
			return candidate, true
		}
	}

	return "", false
}

func buildURLCandidates(value string) []string {
	parsed, err := url.ParseRequestURI(value)
	if err == nil && parsed.Host != "" {
		scheme := strings.ToLower(parsed.Scheme)
		if (scheme == "http" || scheme == "https") && isLikelyPublicHost(parsed.Hostname()) {
			return []string{value}
		}
		return nil
	}

	httpsCandidate := "https://" + value
	parsedHTTPS, err := url.ParseRequestURI(httpsCandidate)
	if err != nil || parsedHTTPS.Host == "" || !isLikelyPublicHost(parsedHTTPS.Hostname()) {
		return nil
	}

	return []string{httpsCandidate, "http://" + value}
}

func (v *URLValidator) probeURLWithGET(rawURL string) bool {
	parsed, err := url.ParseRequestURI(rawURL)
	if err != nil || parsed.Host == "" {
		return false
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return false
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = v.httpClient.DoRequest(ctx, httpclient.Options{
		Method: "GET",
		URL:    rawURL,
	})
	return err == nil
}

func isLikelyPublicHost(host string) bool {
	host = strings.TrimSpace(strings.ToLower(host))
	if host == "" {
		return false
	}
	return strings.Contains(host, ".")
}
