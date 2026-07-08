# Vesti AI Gateway Proxy 部署清单

## 目标

部署一个 Vercel Serverless 代理，将 Vesti 扩展的 OpenAI-compatible 请求转发到**阿里云百炼（DashScope）**，为所有默认安装用户提供 LLM 和 Embedding 能力。

## 项目名建议

`vesti-ai-gateway-proxy`

部署后域名：`https://vesti-ai-gateway-proxy.vercel.app`

## 前置准备

- [ ] 一个 Vercel 账号
- [ ] 阿里云百炼 API Key：`sk-ws-H.EMHRLIL.F9bH...`
- [ ] Git 仓库（可以是本仓库的 `proxy-vercel/` 子目录单独推送到新项目）
- [ ] （可选）自定义 `VESTI_SERVICE_TOKEN`；默认已与扩展端内置值对齐，开箱即用

## 部署步骤

### 1. 准备代码

```bash
cd proxy-vercel
pnpm install
```

### 2. 在 Vercel 创建项目

1. 登录 [vercel.com](https://vercel.com)
2. New Project → Import Git Repository
3. 选择 `proxy-vercel` 所在仓库
4. Framework Preset 选择 **Other**
5. Root Directory 设为 `proxy-vercel`（如果是子目录）

### 3. 配置环境变量

在 Vercel Dashboard → Project → Settings → Environment Variables 中配置：

| 变量名 | 值 | 环境 |
|---|---|---|
| `UPSTREAM_API_KEY` | `sk-ws-H.EMHRLIL.F9bH...` | Production / Preview |
| `UPSTREAM_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | Production / Preview |
| `VESTI_ALLOWED_ORIGINS` | `chrome-extension://*` | Production / Preview |
| `CHAT_PRIMARY_MODEL` | `qwen-plus` | Production / Preview |
| `CHAT_BACKUP_MODEL` | `qwen-turbo` | Production / Preview |
| `EMBEDDING_MODEL` | `text-embedding-v2` | Production / Preview |

`VESTI_SERVICE_TOKEN` 可不配，默认与扩展端内置值一致。

### 4. 部署

```bash
vercel --prod
```

或点击 Vercel Dashboard 中的 **Deploy**。

### 5. 验证代理

```bash
# 测试 chat
curl -X POST https://vesti-gate.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Origin: chrome-extension://test" \
  -H "x-vesti-service-token: vesti-kcq-default-d850d4dcd610a0e2e919eb610f42066faff1e1c57c0c047c" \
  -d '{"model":"qwen-plus","messages":[{"role":"user","content":"hi"}]}'

# 测试 embeddings
curl -X POST https://vesti-gate.vercel.app/api/embeddings \
  -H "Content-Type: application/json" \
  -H "Origin: chrome-extension://test" \
  -H "x-vesti-service-token: vesti-kcq-default-d850d4dcd610a0e2e919eb610f42066faff1e1c57c0c047c" \
  -d '{"model":"text-embedding-v2","input":"hello"}'
```

## 扩展端回填

代理验证通过后，确认 `frontend/src/lib/services/llmConfig.ts` 中的默认地址：

```ts
export const DEFAULT_PROXY_BASE_URL = "https://vesti-gate.vercel.app/api";
```

然后重新构建并发布扩展：

```bash
pnpm -C frontend build
```

## 用户侧设置

- 默认 **Demo proxy** 模式：用户无需任何配置即可使用。
- 高级用户切换到 **BYOK** 模式：填入自己的百炼 key 和 base URL，模型从白名单中选择。

## 支持的模型

### Chat

- `qwen-plus`（默认主模型）
- `qwen-turbo`（默认备用模型）
- `qwen-max`
- `qwen-coder-plus`
- `deepseek-v3`
- `deepseek-r1`

### Embedding

- `text-embedding-v2`（默认，1536 维，与旧系统兼容）
- `text-embedding-v3`（1024 维，切换需重新向量化）

## 注意事项

1. **不要**在仓库中提交真实的 `UPSTREAM_API_KEY`。
2. 当前版本**未做用户限流和配额**。如需公开给大量用户，后续必须补上 Redis 限流。
3. Vercel Hobby 免费档 Functions 有调用次数和 GB-seconds 限制，监控用量。
4. 切换上游提供商时，只需改 `UPSTREAM_BASE_URL` 和 `UPSTREAM_API_KEY`，扩展端无需重新发版。
