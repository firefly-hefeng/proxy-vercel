# Vesti AI Gateway Proxy (Vercel)

Vesti 扩展的默认 Demo 模式代理，部署在 Vercel Serverless Functions 上。

该代理将扩展端的 OpenAI-compatible 请求转发到**上游 LLM 提供商**。默认上游为**阿里云百炼（DashScope）**，可通过环境变量切换为其他 OpenAI-compatible 接口。

## 功能路由

- `POST /api/chat` → 上游 `/chat/completions`
- `POST /api/embeddings` → 上游 `/embeddings`

## 默认上游模型

- Chat 主模型：`qwen-plus`
- Chat 备用模型：`qwen-turbo`
- Embedding 模型：`text-embedding-v2`（1536 维，与旧系统兼容）

## 快速部署

### 1. 安装依赖

```bash
cd proxy-vercel
pnpm install
```

### 2. 本地测试（可选）

先配置环境变量：

```bash
export VESTI_SERVICE_TOKEN=local-test-token
export UPSTREAM_API_KEY=sk-...
export VESTI_ALLOWED_ORIGINS='*'
pnpm vercel dev
```

然后测试：

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-vesti-service-token: local-test-token" \
  -d '{"model":"qwen-plus","messages":[{"role":"user","content":"hi"}]}'
```

### 3. 部署到 Vercel

```bash
pnpm vercel --prod
```

## Vercel 环境变量配置

在 Vercel Dashboard → Project Settings → Environment Variables 中配置：

| 变量名 | 必填 | 说明 |
|---|---|---|
| `VESTI_SERVICE_TOKEN` | 否 | 默认与扩展端内置值一致，开箱即用；也可自定义增强安全性 |
| `UPSTREAM_API_KEY` | 是 | 上游 LLM 提供商 API Key，当前使用阿里云百炼 |
| `UPSTREAM_BASE_URL` | 否 | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `VESTI_ALLOWED_ORIGINS` | 否 | 允许的请求来源，建议 `chrome-extension://*` |
| `CHAT_PRIMARY_MODEL` | 否 | 默认主模型，默认 `qwen-plus` |
| `CHAT_BACKUP_MODEL` | 否 | 故障回退模型，默认 `qwen-turbo` |
| `CHAT_MAX_TOKENS` | 否 | 服务端 `max_tokens` 上限，默认 `1600` |
| `EMBEDDING_MODEL` | 否 | 默认 embedding 模型，默认 `text-embedding-v2` |

## 扩展端配置

部署完成后，把域名回填到扩展代码：

```ts
// frontend/src/lib/services/llmConfig.ts
export const DEFAULT_PROXY_BASE_URL = "https://<你的-vercel-项目名>.vercel.app/api";
```

然后在 Vesti 设置中保持 Demo proxy 模式即可，service token 已内置。

## 支持的 Chat 模型

代理端白名单：

- `qwen-plus`
- `qwen-turbo`
- `qwen-max`
- `qwen-coder-plus`
- `deepseek-v3`
- `deepseek-r1`

不在白名单的模型会被替换为 `CHAT_PRIMARY_MODEL`。

## 设计原则

- **扩展端与上游解耦**：扩展只发 OpenAI-compatible 请求，不感知底层是百炼、OpenAI 还是其他。
- **代理端统一入口**：chat 和 embeddings 走同一个 `UPSTREAM_BASE_URL` 和 `UPSTREAM_API_KEY`。
- **embedding 格式归一化**：扩展端发送标准 `input: string | string[]`，同时兼容 `{text: string}[]` 变体。
