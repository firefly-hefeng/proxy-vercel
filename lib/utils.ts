import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

export function createRequestId(): string {
  return randomUUID();
}

export function setCommonHeaders(
  res: ServerResponse,
  requestId: string
): void {
  res.setHeader("x-request-id", requestId);
  res.setHeader("cache-control", "no-store");
}

export function writeJson(
  res: ServerResponse,
  status: number,
  payload: unknown
): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function buildErrorPayload(
  code: string,
  message: string,
  requestId: string,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    error: {
      code,
      message,
      requestId,
      ...extras,
    },
  };
}

export async function readJsonBody(
  req: IncomingMessage
): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 2_000_000) {
      throw new Error("REQUEST_BODY_TOO_LARGE");
    }
  }
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("upstream_timeout"), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function clampMaxTokens(value: unknown, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return max;
  }
  return Math.max(1, Math.min(Math.floor(value), max));
}

export function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
