import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Globe2, Link2, LoaderCircle } from "lucide-react";
import { MediaCardSlot } from "@/components/media/media-card-slot";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { downloadMedia, fetchHealth, streamMetadataBatch, triggerBlobDownload } from "@/lib/api";
import {
  buildCompactDownloadRequest,
  buildExpandedDownloadRequest,
  createInitialExpandedConfig,
  getCompactChoices,
  normalizeUrlInput,
  syncExpandedConfigToCompactChoice,
  type ExpandedConfig,
  type MediaCard as MediaCardRecord,
  type MediaMetadata,
  type QuickQualityMode,
  type SuccessMediaCard,
} from "@/lib/media";


export default function App() {
  const [input, setInput] = React.useState("");
  const [invalidLines, setInvalidLines] = React.useState<string[]>([]);
  const [cards, setCards] = React.useState<MediaCardRecord[]>([]);
  const [batchFatal, setBatchFatal] = React.useState<string | null>(null);
  const cardsRef = React.useRef<MediaCardRecord[]>([]);
  const batchControllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  React.useEffect(() => {
    return () => {
      batchControllerRef.current?.abort();
    };
  }, []);

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });

  const fetchMutation = useMutation({
    mutationFn: async (urls: string[]) => {
      batchControllerRef.current?.abort();

      const controller = new AbortController();
      batchControllerRef.current = controller;

      try {
        await streamMetadataBatch(
          { urls },
          {
            signal: controller.signal,
            onEvent: (event) => {
              switch (event.event) {
                case "item":
                  replaceCardWithSuccess(event.payload.index, event.payload.url, event.payload.data);
                  break;
                case "error":
                  replaceCardWithError(event.payload.index, event.payload.url, event.payload.error);
                  break;
                case "fatal":
                  setBatchFatal(event.payload.error);
                  break;
                case "ready":
                case "done":
                default:
                  break;
              }
            },
          },
        );
      } finally {
        if (batchControllerRef.current === controller) {
          batchControllerRef.current = null;
        }
      }
    },
    onError: (error) => {
      if (isAbortError(error)) {
        return;
      }

      setBatchFatal(error instanceof Error ? error.message : "The metadata stream failed unexpectedly.");
    },
  });

  const healthLabel = healthQuery.isSuccess
    ? "Backend online"
    : healthQuery.isFetching
      ? "Checking backend"
      : "Backend offline";

  const pendingCount = cards.filter((card) => card.state === "pending").length;
  const successfulCount = cards.filter((card) => card.state === "success").length;

  function replaceCardWithSuccess(index: number, url: string, metadata: MediaMetadata) {
    setCards((current) =>
      current.map((card) => (card.index === index ? createSuccessCard(index, url, metadata) : card)),
    );
  }

  function replaceCardWithError(index: number, url: string, message: string) {
    setCards((current) =>
      current.map((card) =>
        card.index === index
          ? {
              state: "error" as const,
              index,
              url,
              message,
            }
          : card,
      ),
    );
  }

  function updateSuccessCard(index: number, updater: (card: SuccessMediaCard) => SuccessMediaCard) {
    setCards((current) =>
      current.map((card) => {
        if (card.state !== "success" || card.index !== index) {
          return card;
        }

        return updater(card);
      }),
    );
  }

  async function handleFetch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const { urls, invalidLines: nextInvalidLines } = normalizeUrlInput(input);
    setInvalidLines(nextInvalidLines);
    setBatchFatal(null);

    if (urls.length === 0) {
      setCards([]);
      return;
    }

    setCards(
      urls.map((url, index) => ({
        state: "pending" as const,
        index,
        url,
      })),
    );

    fetchMutation.mutate(urls);
  }

  function handleCompactChoiceChange(index: number, compactChoiceId: string) {
    updateSuccessCard(index, (card) => ({
      ...card,
      compactChoiceId,
      config: card.config.overrideQuickQuality
        ? card.config
        : syncExpandedConfigToCompactChoice(card.metadata, card.config, compactChoiceId, card.quickQualityMode),
      download: { status: "idle" },
    }));
  }

  function handleQuickQualityModeChange(index: number, quickQualityMode: QuickQualityMode) {
    updateSuccessCard(index, (card) => {
      const compactChoices = getCompactChoices(card.metadata, quickQualityMode);
      const hasCurrentChoice = compactChoices.some((choice) => choice.id === card.compactChoiceId);

      return {
        ...card,
        quickQualityMode,
        compactChoiceId: hasCurrentChoice ? card.compactChoiceId : (compactChoices[0]?.id ?? ""),
        config: card.config.overrideQuickQuality
          ? card.config
          : syncExpandedConfigToCompactChoice(
              card.metadata,
              card.config,
              hasCurrentChoice ? card.compactChoiceId : (compactChoices[0]?.id ?? ""),
              quickQualityMode,
            ),
        download: { status: "idle" },
      };
    });
  }

  function handleConfigChange(index: number, updater: (current: ExpandedConfig) => ExpandedConfig) {
    updateSuccessCard(index, (card) => ({
      ...card,
      config: (() => {
        const nextConfig = updater(card.config);

        return nextConfig.overrideQuickQuality
          ? nextConfig
          : syncExpandedConfigToCompactChoice(card.metadata, nextConfig, card.compactChoiceId, card.quickQualityMode);
      })(),
      download: { status: "idle" },
    }));
  }

  async function handleCompactDownload(index: number) {
    const card = cardsRef.current.find((item) => item.state === "success" && item.index === index);
    if (!card || card.state !== "success") {
      return;
    }

    updateSuccessCard(index, (current) => ({
      ...current,
      download: { status: "pending" },
    }));

    try {
      const request = buildCompactDownloadRequest(card.url, card.metadata, card.compactChoiceId, card.quickQualityMode);
      const result = await downloadMedia(request);
      triggerBlobDownload(result.blob, result.filename);

      updateSuccessCard(index, (current) => ({
        ...current,
        download: { status: "idle" },
      }));
    } catch (error) {
      updateSuccessCard(index, (current) => ({
        ...current,
        download: {
          status: "error",
          message: error instanceof Error ? error.message : "Download failed.",
        },
      }));
    }
  }

  async function handleExpandedDownload(index: number) {
    const card = cardsRef.current.find((item) => item.state === "success" && item.index === index);
    if (!card || card.state !== "success") {
      return;
    }

    updateSuccessCard(index, (current) => ({
      ...current,
      download: { status: "pending" },
    }));

    try {
      const request = buildExpandedDownloadRequest(card.url, card.metadata, card.config);
      const result = await downloadMedia(request);
      triggerBlobDownload(result.blob, result.filename);

      updateSuccessCard(index, (current) => ({
        ...current,
        download: { status: "idle" },
      }));
    } catch (error) {
      updateSuccessCard(index, (current) => ({
        ...current,
        download: {
          status: "error",
          message: error instanceof Error ? error.message : "Download failed.",
        },
      }));
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
        <section className="nodus-surface px-5 py-6 md:px-8 md:py-8">
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <p className="section-kicker">Nodus media</p>
                <h1 className="hero-title text-balance text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem]">
                  Fetch metadata from media links
                </h1>
                <p className="max-w-2xl text-pretty text-base leading-7 text-muted-foreground md:text-lg">
                  Paste one URL per line, wait for cards to resolve, then download quickly or open detailed format options.
                </p>
              </div>

              <Badge variant="outline" className="gap-2 px-4 py-2 text-[0.7rem]">
                <span
                  className={[
                    "size-2 rounded-full",
                    healthQuery.isSuccess ? "bg-emerald-400" : healthQuery.isFetching ? "bg-amber-300" : "bg-red-400",
                  ].join(" ")}
                />
                {healthLabel}
              </Badge>
            </div>

            <form className="grid gap-4" onSubmit={handleFetch}>
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={[
                  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                  "https://vimeo.com/123456789",
                ].join("\n")}
                className="min-h-[8.5rem] text-base md:text-lg"
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className="gap-2">
                    <Globe2 className="size-3.5" />
                    {cards.length} total
                  </Badge>
                  <Badge variant="outline" className="gap-2">
                    <LoaderCircle className={pendingCount > 0 ? "size-3.5 animate-spin" : "size-3.5"} />
                    {pendingCount} pending
                  </Badge>
                  <Badge variant="outline" className="gap-2">
                    <Link2 className="size-3.5" />
                    {successfulCount} ready
                  </Badge>
                </div>

                <Button size="lg" className="min-w-[11rem]" type="submit">
                  {fetchMutation.isPending ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Fetching
                    </>
                  ) : (
                    <>
                      <Link2 className="size-4" />
                      Fetch
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </section>

        {invalidLines.length > 0 ? (
          <Alert variant="destructive" className="nodus-alert">
            <AlertCircle />
            <AlertTitle>Skipped invalid lines</AlertTitle>
            <AlertDescription>
              {invalidLines.length === 1
                ? `This line is not a valid http/https URL: ${invalidLines[0]}`
                : `${invalidLines.length} lines were skipped because they are not valid http/https URLs.`}
            </AlertDescription>
          </Alert>
        ) : null}

        {batchFatal ? (
          <Alert variant="destructive" className="nodus-alert">
            <AlertCircle />
            <AlertTitle>Stream interrupted</AlertTitle>
            <AlertDescription>{batchFatal}</AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="section-kicker">Fetched cards</p>
              <h2 className="font-display text-4xl tracking-[-0.04em] text-foreground md:text-5xl">Results</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="gap-2">
                <Globe2 className="size-3.5" />
                {cards.length} total
              </Badge>
              {pendingCount > 0 ? (
                <Badge variant="outline" className="gap-2">
                  <LoaderCircle className="size-3.5 animate-spin" />
                  {pendingCount} pending
                </Badge>
              ) : null}
            </div>
          </div>

          {cards.length === 0 ? (
            <Card className="nodus-surface flex min-h-[19rem] items-center justify-center px-6 py-10 text-center lg:min-h-[19rem]">
              <div className="mx-auto max-w-2xl space-y-3">
                <p className="section-kicker">Nothing here yet</p>
                <h3 className="font-display text-4xl tracking-[-0.04em] text-foreground">Cards will appear below</h3>
                <p className="text-base leading-7 text-muted-foreground">
                  Start with one or several media URLs. Each link reserves its own slot and gets replaced in order as the
                  backend streams metadata back.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {cards.map((card) => {
                return (
                  <MediaCardSlot
                    key={`${card.index}:${card.url}`}
                     card={card}
                     onCompactChoiceChange={handleCompactChoiceChange}
                     onQuickQualityModeChange={handleQuickQualityModeChange}
                     onConfigChange={handleConfigChange}
                     onCompactDownload={handleCompactDownload}
                     onExpandedDownload={handleExpandedDownload}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function createSuccessCard(index: number, url: string, metadata: MediaMetadata): SuccessMediaCard {
  const compactChoices = getCompactChoices(metadata, "quality");

  return {
    state: "success",
    index,
    url,
    metadata,
    compactChoiceId: compactChoices[0]?.id ?? "",
    quickQualityMode: "quality",
    config: createInitialExpandedConfig(metadata),
    download: { status: "idle" },
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
