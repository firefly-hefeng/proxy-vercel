import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ALLOWED_CHAT_MODELS,
  ALLOWED_CHAT_ROLES,
  CHAT_BACKUP_MODEL,
  CHAT_MAX_TOKENS,
  CHAT_PRIMARY_MODEL,
  CHAT_UPSTREAM_URL,
  isUpstreamConfigured,
  UPSTREAM_API_KEY,
  UPSTREAM_TIMEOUT_MS,
} from "./config.js";
import {
  buildErrorPayload,
  clampMaxTokens,
  fetchWithTimeout,
  readJsonBody,
  writeJson,
} from "./utils.js";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: unknown;
}

function sanitizeChatPayload(body: Record<string, unknown>) {
  const requestedModel =
    typeof body.model === "string" ? body.model.trim() : "";
  const model = ALLOWED_CHAT_MODELS.has(requestedModel)
    ? requestedModel
    : CHAT_PRIMARY_MODEL;

  const messages = Array.isArray(body.messages)
    ? (body.messages
        .filter(
          (item): item is Record<string, unknown> =>
            item !== null && typeof item === "object"
        )
        .filter((item) => ALLOWED_CHAT_ROLES.has(String(item.role)))
        .map((item) => ({
          role: String(item.role),
          content: item.content,
        })) as ChatMessage[])
    : [];

  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature:
      typeof body.temperature === "number" && Number.isFinite(body.temperature)
        ? body.temperature
        : 0.3,
    max_tokens: clampMaxTokens(body.max_tokens, CHAT_MAX_TOKENS),
  };

  if (
    body.response_format &&
    typeof body.response_format === "object" &&
    !Array.isArray(body.response_format) &&
    (body.response_format as Record<string, unknown>).type === "json_object"
  ) {
    payload.response_format = { type: "json_object" };
  }

  if (typeof body.stream === "boolean") {
    payload.stream = body.stream;
  }

  return payload;
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function handleChat(
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

  const payload = sanitizeChatPayload(body);
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    writeJson(
      res,
      400,
      buildErrorPayload(
        "INVALID_MESSAGES",
        "Payload must include valid messages.",
        requestId
      )
    );
    return;
  }

  const startedAt = Date.now();
  const attempts = [
    { model: String(payload.model), attempt: 1 },
    {
      model:
        String(payload.model) === CHAT_PRIMARY_MODEL
          ? CHAT_BACKUP_MODEL
          : CHAT_PRIMARY_MODEL,
      attempt: 2,
    },
  ];

  let finalStatus = 502;
  let finalBody = "";
  let finalModel = attempts[0].model;
  let finalAttempt = 1;

  for (const step of attempts) {
    const chatPayload = { ...payload, model: step.model };

    try {
      const upstream = await fetchWithTimeout(
        CHAT_UPSTREAM_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${UPSTREAM_API_KEY}`,
          },
          body: JSON.stringify(chatPayload),
        },
        UPSTREAM_TIMEOUT_MS
      );

      finalStatus = upstream.status;
      finalBody = await upstream.text();
      finalModel = step.model;
      finalAttempt = step.attempt;

      if (!shouldRetryStatus(upstream.status) || step.attempt === 2) {
        break;
      }
    } catch (error) {
      finalStatus = 502;
      finalBody = JSON.stringify(
        buildErrorPayload(
          "UPSTREAM_NETWORK_ERROR",
          "Failed to reach chat upstream.",
          requestId,
          { cause: String(error) }
        )
      );
      finalModel = step.model;
      finalAttempt = step.attempt;

      if (step.attempt === 2) {
        break;
      }
    }
  }

  res.statusCode = finalStatus;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("x-proxy-model-used", finalModel);
  res.setHeader("x-proxy-attempt", String(finalAttempt));
  res.setHeader("x-proxy-requested-max-tokens", String(body?.max_tokens ?? ""));
  res.setHeader("x-proxy-effective-max-tokens", String(payload.max_tokens));
  res.setHeader("x-proxy-max-tokens-limit", String(CHAT_MAX_TOKENS));
  if (origin && allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }
  res.end(finalBody);

  console.info(
    JSON.stringify({
      route: "/api/chat",
      requestId,
      origin: origin || null,
      upstreamStatus: finalStatus,
      model: finalModel,
      attempt: finalAttempt,
      latencyMs: Date.now() - startedAt,
    })
  );
}
