import type { IncomingMessage, ServerResponse } from "node:http";
import {
  EMBED_BATCH_MAX,
  EMBED_TEXT_MAX_CHARS,
  EMBEDDING_MODEL,
  EMBEDDING_UPSTREAM_URL,
  isUpstreamConfigured,
  UPSTREAM_API_KEY,
  UPSTREAM_TIMEOUT_MS,
} from "./config.js";
import {
  buildErrorPayload,
  fetchWithTimeout,
  readJsonBody,
  writeJson,
} from "./utils.js";

function normalizeEmbeddingInput(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.input)) {
    return body.input
      .map((item) => {
        // 标准 OpenAI 格式：string | string[]
        if (typeof item === "string") return item.trim();
        // 兼容部分网关使用的 { text: string } 格式
        if (
          item !== null &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          typeof (item as Record<string, unknown>).text === "string"
        ) {
          return String((item as Record<string, unknown>).text).trim();
        }
        return "";
      })
      .filter((text) => text.length > 0);
  }
  if (typeof body.input === "string") {
    return [body.input.trim()];
  }
  return [];
}

export async function handleEmbeddings(
  req: IncomingMessage,
  res: ServerResponse,
  requestId: string,
  origin: string | null,
  allowedOrigin: string | null
): Promise<void> {
  if (!isUpstreamConfigured()) {
    writeJson(
      res,
      500,
      buildErrorPayload(
        "PROXY_API_KEY_MISSING",
        "UPSTREAM_API_KEY is not configured on the proxy.",
        requestId
      )
    );
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch {
    writeJson(
      res,
      400,
      buildErrorPayload("INVALID_JSON", "Request body must be valid JSON.", requestId)
    );
    return;
  }

  const input = normalizeEmbeddingInput(body).filter((text) => text.length > 0);
  if (input.length === 0) {
    writeJson(
      res,
      400,
      buildErrorPayload(
        "INVALID_INPUT",
        "Embedding input cannot be empty.",
        requestId
      )
    );
    return;
  }
  if (input.length > EMBED_BATCH_MAX) {
    writeJson(
      res,
      413,
      buildErrorPayload(
        "BATCH_TOO_LARGE",
        `Batch size exceeds ${EMBED_BATCH_MAX}.`,
        requestId
      )
    );
    return;
  }
  if (input.some((text) => text.length > EMBED_TEXT_MAX_CHARS)) {
    writeJson(
      res,
      422,
      buildErrorPayload(
        "TEXT_TOO_LONG",
        `Single text exceeds ${EMBED_TEXT_MAX_CHARS} characters.`,
        requestId
      )
    );
    return;
  }

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : EMBEDDING_MODEL;

  const payload = {
    model,
    input,
    encoding_format: "float",
  };

  const startedAt = Date.now();
  try {
    const upstream = await fetchWithTimeout(
      EMBEDDING_UPSTREAM_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${UPSTREAM_API_KEY}`,
        },
        body: JSON.stringify(payload),
      },
      UPSTREAM_TIMEOUT_MS
    );

    const responseText = await upstream.text();

    if (origin && allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    }

    if (!upstream.ok) {
      const detail = responseText.slice(0, 1200);
      writeJson(
        res,
        upstream.status,
        buildErrorPayload(
          "UPSTREAM_EMBEDDING_ERROR",
          "Embedding upstream request failed.",
          requestId,
          {
            upstreamStatus: upstream.status,
            detail,
          }
        )
      );
    } else {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(responseText);
    }

    console.info(
      JSON.stringify({
        route: "/api/embeddings",
        requestId,
        origin: origin || null,
        batchSize: input.length,
        model,
        upstreamStatus: upstream.status,
        latencyMs: Date.now() - startedAt,
      })
    );
  } catch (error) {
    if (origin && allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    }
    writeJson(
      res,
      502,
      buildErrorPayload(
        "UPSTREAM_NETWORK_ERROR",
        "Failed to reach embeddings upstream.",
        requestId,
        { cause: String(error) }
      )
    );
  }
}
