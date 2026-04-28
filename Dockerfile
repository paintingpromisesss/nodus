FROM golang:1.25-bookworm AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/nodus-backend ./cmd

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    python3 \
    python3-pip \
    && python3 -m pip install --break-system-packages --no-cache-dir "yt-dlp[default]" \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /out/nodus-backend /app/nodus-backend

EXPOSE 8888

CMD ["/app/nodus-backend"]
