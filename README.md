# 眼科智能体服务（Next.js + LangGraph）

该服务提供以下能力：

- SSR AI 助手页面：`/ai`
- 智能体对话接口：`/api/chat`
- PDF 上传代理接口：`/api/pdf`
- 通过 Function Calling 对接现有 Java 业务接口
- 内部 RAG 检索 + 可选联网搜索

## 1. 安装与环境准备

```bash
npm install
cp .env.example .env.local
```

请在 `.env.local` 中填写：

- `OPENAI_API_KEY`（或 `DASHSCOPE_API_KEY`）
- `OPENAI_BASE_URL`（百炼兼容地址示例已提供）
- `OPENAI_MODEL`
- `JAVA_API_BASE_URL`
- Java 侧具体接口路径
- 可选：`TAVILY_API_KEY`（用于联网搜索）

## 2. 启动项目

```bash
npm run dev
```

浏览器访问：`http://localhost:3000/ai`

## 3. 在现有 Vue 系统通过 iframe 嵌入

```html
<iframe
  src="http://localhost:3000/ai?token=YOUR_TOKEN"
  style="width: 100%; height: 100%; border: 0;"
  allow="clipboard-read; clipboard-write"
></iframe>
```

## 4. 项目架构

### 4.1 目录结构

```text
app/
  ai/
    page.tsx                 # AI 页面入口（读取 token）
    AiAssistantClient.tsx    # 聊天 UI 与前端调用逻辑
  api/
    chat/route.ts            # 对话 API，调用 LangGraph 智能体
    pdf/route.ts             # PDF 上传代理到 Java 后端
  layout.tsx                 # 全局布局
  page.tsx                   # 首页说明

lib/
  agent/
    index.ts                 # 智能体入口（模型、Prompt、工具挂载）
    tools/
      business-tools.ts      # Java 业务工具（病例查询、PDF 分析）
      rag-tools.ts           # RAG 工具与可选联网搜索工具
```

### 4.2 运行链路

```text
前端 /ai 页面
  -> POST /api/chat
  -> runAgent(lib/agent/index.ts)
  -> LangGraph 工具调用
     -> business-tools.ts 调 Java 接口
     -> rag-tools.ts 做知识检索/联网搜索
  -> 返回答案到前端消息流

前端上传 PDF
  -> POST /api/pdf
  -> Java 文件上传接口
```

## 5. API 契约

### 5.1 POST `/api/chat`

请求体：

```json
{
  "question": "帮我查询病人 1024 的病例信息",
  "threadId": "可选，会话ID"
}
```

请求头（二选一）：

- `authentication: <token>`（兼容现有 Java 头）
- `Authorization: Bearer <token>`

响应体：

```json
{
  "threadId": "session-id",
  "data": "助手回答内容"
}
```

### 5.2 POST `/api/pdf`

该接口为透传代理：前端提交 `multipart/form-data`，服务端转发到 Java 的 PDF 上传接口。

## 6. 当前实现说明

- RAG 当前仍是内存版示例，位于 `lib/agent/tools/rag-tools.ts`。
- 生产环境建议替换为向量数据库检索（例如 PGVector、Milvus、Pinecone）。
- 业务工具位于 `lib/agent/tools/business-tools.ts`，可按 Java 接口持续扩展。
