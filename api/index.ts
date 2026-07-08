import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createRequestId, setCommonHeaders, writeJson } from "../lib/utils.js";
import { readOrigin, resolveAllowedOrigin, setCorsHeaders } from "../lib/cors.js";

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

  writeJson(res, 404, {
    error: {
      code: "NOT_FOUND",
      message: "This is the Vesti AI Gateway Proxy. Available routes: POST /api/chat, POST /api/embeddings.",
      requestId,
    },
  });
}
