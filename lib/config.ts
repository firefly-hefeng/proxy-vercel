// 默认代理 service token，与扩展端内置值保持一致。
// 用户无需手动填写，Demo proxy 模式开箱即用。
// 如需增强安全性，可在 Vercel 环境变量中覆盖 VESTI_SERVICE_TOKEN。
export const DEFAULT_SERVICE_TOKEN = "vesti-kcq-default-d850d4dcd610a0e2e919eb610f42066faff1e1c57c0c047c";
export const SERVICE_TOKEN = (process.env.VESTI_SERVICE_TOKEN || DEFAULT_SERVICE_TOKEN).trim();

export const ALLOWED_ORIGINS = (process.env.VESTI_ALLOWED_ORIGINS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

// 上游 LLM 提供商：默认阿里云百炼（DashScope），OpenAI-compatible
export const UPSTREAM_API_KEY = (process.env.UPSTREAM_API_KEY || "").trim();
export const UPSTREAM_BASE_URL =
  (process.env.UPSTREAM_BASE_URL || "").trim() ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

export const CHAT_UPSTREAM_URL = `${UPSTREAM_BASE_URL.replace(/\/$/, "")}/chat/completions`;
export const EMBEDDING_UPSTREAM_URL = `${UPSTREAM_BASE_URL.replace(/\/$/, "")}/embeddings`;

// 默认模型配置
export const CHAT_PRIMARY_MODEL =
  (process.env.CHAT_PRIMARY_MODEL || "").trim() || "qwen-plus";
export const CHAT_BACKUP_MODEL =
  (process.env.CHAT_BACKUP_MODEL || "").trim() || "qwen-turbo";
export const CHAT_MAX_TOKENS = Number.parseInt(
  process.env.CHAT_MAX_TOKENS || "1600",
  10
);

export const EMBEDDING_MODEL =
  (process.env.EMBEDDING_MODEL || "").trim() || "text-embedding-v2";
export const EMBED_BATCH_MAX = Number.parseInt(
  process.env.EMBED_BATCH_MAX || "32",
  10
);
export const EMBED_TEXT_MAX_CHARS = Number.parseInt(
  process.env.EMBED_TEXT_MAX_CHARS || "8000",
  10
);

export const UPSTREAM_TIMEOUT_MS = Number.parseInt(
  process.env.UPSTREAM_TIMEOUT_MS || "60000",
  10
);

export const ALLOWED_CHAT_ROLES = new Set(["system", "user", "assistant"]);

// 代理端允许 upstream 使用的模型白名单。
// 不在白名单的请求会被替换为默认主模型。
export const ALLOWED_CHAT_MODELS = new Set([
  CHAT_PRIMARY_MODEL,
  CHAT_BACKUP_MODEL,
  "qwen-plus",
  "qwen-turbo",
  "qwen-max",
  "qwen-coder-plus",
  "deepseek-v3",
  "deepseek-r1",
]);

export function isServiceConfigured(): boolean {
  return Boolean(SERVICE_TOKEN);
}

export function isUpstreamConfigured(): boolean {
  return Boolean(UPSTREAM_API_KEY);
}
