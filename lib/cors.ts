import { ALLOWED_ORIGINS } from "./config.js";

function originMatchesRule(origin: string, rule: string): boolean {
  if (rule === "*") return true;
  if (rule === "chrome-extension://*") {
    return origin.startsWith("chrome-extension://");
  }
  if (rule.endsWith("*")) {
    return origin.startsWith(rule.slice(0, -1));
  }
  return origin === rule;
}

export function resolveAllowedOrigin(origin: string): string | null {
  if (!origin) return null;
  for (const rule of ALLOWED_ORIGINS) {
    if (originMatchesRule(origin, rule)) {
      return rule === "*" ? "*" : origin;
    }
  }
  return null;
}

export function setCorsHeaders(
  res: import("http").ServerResponse,
  allowedOrigin: string | null
): void {
  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-vesti-service-token"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "x-request-id, x-proxy-model-used, x-proxy-attempt, x-proxy-requested-max-tokens, x-proxy-effective-max-tokens, x-proxy-max-tokens-limit"
  );
}

export function readOrigin(req: import("http").IncomingMessage): string {
  return typeof req.headers.origin === "string" ? req.headers.origin : "";
}
