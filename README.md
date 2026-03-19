# 眼科智能体服务（Next.js + LangGraph）

该服务提供以下能力：

- SSR AI 助手页面：`/ai`
- 智能体对话接口：`/api/chat`
- 通过 Function Calling 对接现有 Java 业务接口
- 内部 RAG 检索 + 千问原生联网搜索

## 当前进度（已实现）

1. 最基础 LLM 调用已实现（Qwen/OpenAI 兼容模式）。
2. 联网搜索已实现（支持前端开关控制，并传入后端）。
3. RAG 静态知识库检索已实现（种子库 + 检索服务解耦）。
4. Function-call 调用 Java 接口已实现（按钮触发专用，普通输入不触发业务工具）。
5. 医疗回答规范已外置文档加载（非硬编码在代码中）。
6. RAG 批量校验脚本已实现（命中率与引用完整率统计）。

## 1. 安装与环境准备

```bash
npm install
cp .env.example .env.local
```

请在 `.env.local` 中填写：

- `OPENAI_API_KEY`（或 `DASHSCOPE_API_KEY`）
- `OPENAI_BASE_URL`（百炼兼容地址示例已提供）
- `OPENAI_MODEL`
- `QWEN_ENABLE_SEARCH`（是否启用联网搜索）
- `AGENT_SYSTEM_PROMPT_PATH`（可选，系统提示词文件路径）
- `JAVA_API_BASE_URL`
- Java 侧具体接口路径
  - `JAVA_PATIENT_LIST_PATH`
  - `JAVA_DIAGNOSIS_HISTORY_PATH`
  - `JAVA_APPOINTMENTS_PATH`

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
  layout.tsx                 # 全局布局
  page.tsx                   # 首页说明

lib/
  agent/
    index.ts                 # 智能体入口（模型、Prompt、工具挂载）
    docs/
      medical-response-policy.v1.md  # 医疗回答规范与系统提示词主文件
      knowledge-base.v1.json         # RAG 首批知识库种子文档
    rag/
      config.ts                      # RAG 检索参数配置（topK、阈值等）
      search-service.ts              # RAG 轻量检索服务（可后续替换向量库）
      types.ts                       # RAG 类型定义
    tools/
      business/
        index.ts             # 业务工具聚合出口
        java-api.ts          # Java 接口调用封装
        patient-list.ts      # 患者列表工具
        diagnosis-history.ts # 诊断记录工具
        appointments.ts      # 预约管理工具
      rag-tools.ts           # RAG 工具（联网搜索由模型原生能力提供）
```

### 4.2 运行链路

```text
前端 /ai 页面
  -> POST /api/chat
  -> runAgent(lib/agent/index.ts)
  -> LangGraph 工具调用
    -> business/* 调 Java 接口
      -> rag-tools.ts 做知识检索
    -> 模型原生联网搜索（QWEN_ENABLE_SEARCH）
  -> 返回答案到前端消息流
```

## 5. API 契约

### 5.1 POST `/api/chat`

请求体：

```json
{
  "question": "帮我查询病人 1024 的病例信息",
  "threadId": "可选，会话ID",
  "allowBusinessToolCall": false,
  "preferredBusinessAction": "patient_list"
}
```

字段说明：

- `allowBusinessToolCall`: 是否允许调用 Java 业务工具。普通输入应为 `false`。
- `preferredBusinessAction`: 可选值 `patient_list | diagnosis_history | appointments`，用于快捷按钮场景。

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

## 6. 当前实现说明

- RAG 已按“数据/配置/检索逻辑”解耦：
  - 文档数据在 `lib/agent/docs/knowledge-base.v1.json`
  - 检索配置在 `lib/agent/rag/config.ts`
  - 检索实现在 `lib/agent/rag/search-service.ts`
- 当前是轻量检索版，后续可在不改工具接口的前提下替换为向量数据库检索（例如 PGVector、Milvus、Pinecone）。
- 业务工具已拆分到 `lib/agent/tools/business/`，每个 function-call 单独文件管理，后续可按接口继续扩展。
- 回答会在有检索命中时强制补齐引用格式：`[文档标题@版本号#章节]`。

## 7. 下一步增强（未完成）

1. 将轻量关键词检索升级为混合检索（向量 + 关键词 + 重排）。
2. 扩充知识库内容粒度（从摘要级提升到段落级/章节级）。
3. 强化规则校验（风险分级、禁用词、未命中硬约束）。
4. 增加结构化回传（本次是否联网、是否调用业务工具、来源摘要）。
5. 扩展评测集并按场景分开统计（普通问答、工具调用、时效性问题）。

## 8. RAG 批量校验

项目内置了 10 条问答校验集：`lib/agent/docs/rag-eval-qa.v1.json`。

执行命令：

```bash
npm run validate:rag
```

说明：

- 该脚本会调用 `/api/chat` 批量提问。
- 输出每条问答的“命中/引用完整”结果。
- 最终输出“命中率”和“引用完整率”。
- 默认请求地址为 `http://localhost:3000/api/chat`，可通过环境变量 `CHAT_API_URL` 覆盖。
