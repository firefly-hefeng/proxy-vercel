import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createRequestId, setCommonHeaders } from "../lib/utils.js";
import { handleChat } from "../lib/chat.js";
import { isServiceConfigured, SERVICE_TOKEN } from "../lib/config.js";
import { readOrigin, resolveAllowedOrigin, setCorsHeaders } from "../lib/cors.js";
import { buildErrorPayload, writeJson } from "../lib/utils.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const requestId = createRequestId();
  const origin = readOrigin(req);
  const allowedOrigin = resolveAllowedOrigin(origin);

  setCommonHeaders(res, requestId);
  setCorsHeaders(res, allowedOrigin);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    writeJson(
      res,
      405,
      buildErrorPayload(
        "METHOD_NOT_ALLOWED",
        "Only POST and OPTIONS are supported.",
        requestId
      )
    );
    return;
  }

  if (origin && !allowedOrigin) {
    writeJson(
      res,
      403,
      buildErrorPayload("ORIGIN_FORBIDDEN", "Origin is not allowed.", requestId)
    );
    return;
  }

  if (!isServiceConfigured()) {
    writeJson(
      res,
      500,
      buildErrorPayload(
        "SERVICE_TOKEN_NOT_CONFIGURED",
        "VESTI_SERVICE_TOKEN is not configured on the proxy.",
        requestId
      )
    );
    return;
  }

  const providedToken = (req.headers["x-vesti-service-token"] || "")
    .toString()
    .trim();
  if (!providedToken || providedToken !== SERVICE_TOKEN) {
    writeJson(
      res,
      401,
      buildErrorPayload(
        "UNAUTHORIZED",
        "Missing or invalid service token.",
        requestId
      )
    );
    return;
  }

  await handleChat(req, res, requestId, origin, allowedOrigin);
}
