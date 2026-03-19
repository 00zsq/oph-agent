# 眼科智能体服务（Oph Agent）

面向眼科业务场景的智能问答服务，基于 Next.js App Router + LangGraph。当前版本已经打通以下主链路：

- AI 聊天页面（/ai）
- 对话 API（/api/chat）
- 内部 RAG 检索
- 千问原生联网搜索
- Java 业务接口 Function-call（按钮触发）

## 1. 架构总览

```mermaid
flowchart TD
    UI[前端聊天页 /ai] --> API[/api/chat]
    API --> AGENT[LangGraph Agent]

    AGENT --> RAG[内部知识检索 search_internal_knowledge_base]
    AGENT --> WEB[千问原生联网搜索 enable_search]
    AGENT --> BIZ[业务工具组 business/*]

    BIZ --> JAVA[现有 Java 后端接口]

    RAG --> MERGE[答案综合与引用补齐]
    WEB --> MERGE
    BIZ --> MERGE

    MERGE --> UI
```

## 2. 当前能力（已实现）

### 2.1 对话与页面能力

1. `/ai` 页面可直接使用，支持 iframe 嵌入。
2. 支持联网开关（前端控制，后端按请求生效）。
3. 支持 Markdown 富文本渲染（标题、列表、表格、链接等）。
4. 普通输入与快捷按钮分流。

### 2.2 Agent 与模型能力

1. 使用 OpenAI 兼容接口接入 Qwen（DashScope 兼容地址）。
2. 可通过环境变量控制模型名、是否深度思考、是否联网、是否强制联网。
3. 系统提示词从文档加载（非硬编码）。

### 2.3 RAG 能力

1. 已实现静态知识库检索（种子文档 + 检索服务解耦）。
2. 命中时自动附带引用。
3. 最终答案有引用兜底补齐逻辑（格式：`[文档标题@版本号#章节]`）。

### 2.4 Function-call 能力

1. 已接入 3 个业务工具：患者列表、诊断记录、预约管理。
2. 工具按“一个接口一个文件”拆分，便于扩展。
3. 默认规则：普通输入不触发业务工具，仅快捷按钮触发。

### 2.5 评测能力

1. 已提供批量 RAG 校验脚本。
2. 可统计命中率与引用完整率。

## 3. 使用方法

### 3.1 安装与配置

```bash
npm install
cp .env.example .env.local
```

在 `.env.local` 中至少配置：

- `OPENAI_API_KEY` 或 `DASHSCOPE_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `QWEN_ENABLE_SEARCH`
- `JAVA_API_BASE_URL`
- `JAVA_PATIENT_LIST_PATH`
- `JAVA_DIAGNOSIS_HISTORY_PATH`
- `JAVA_APPOINTMENTS_PATH`

可选项：

- `QWEN_ENABLE_THINKING`
- `QWEN_FORCED_SEARCH`
- `AGENT_SYSTEM_PROMPT_PATH`

### 3.2 启动

```bash
npm run dev
```

访问：`http://localhost:3000/ai`

### 3.3 iframe 嵌入（Vue 等宿主系统）

```html
<iframe
  src="http://localhost:3000/ai?token=YOUR_TOKEN"
  style="width:100%;height:100%;border:0;"
  allow="clipboard-read; clipboard-write"
></iframe>
```

### 3.4 对话接口调用

接口：`POST /api/chat`

请求体示例：

```json
{
  "question": "请帮我查询当前患者列表（第1页，每页10条）",
  "threadId": "optional-thread-id",
  "enableWebSearch": true,
  "allowBusinessToolCall": true,
  "preferredBusinessAction": "patient_list"
}
```

字段说明：

- `allowBusinessToolCall`：是否允许调用业务工具。
- `preferredBusinessAction`：可选值 `patient_list | diagnosis_history | appointments`。
- `enableWebSearch`：是否允许模型联网。

请求头支持：

- `authentication: <token>`（兼容旧系统）
- `Authorization: Bearer <token>`

### 3.5 批量评测

```bash
npm run validate:rag
```

说明：

1. 读取问答集：`lib/agent/docs/rag-eval-qa.v1.json`。
2. 默认请求：`http://localhost:3000/api/chat`。
3. 输出每题结果与汇总指标。

## 4. 目录说明

```text
app/
  ai/
    page.tsx
    AiAssistantClient.tsx
  api/
    chat/route.ts

lib/
  agent/
    index.ts
    docs/
      medical-response-policy.v1.md
      knowledge-base.v1.json
      rag-eval-qa.v1.json
    rag/
      config.ts
      search-service.ts
      types.ts
    tools/
      rag-tools.ts
      business/
        index.ts
        java-api.ts
        patient-list.ts
        diagnosis-history.ts
        appointments.ts
        types.ts

scripts/
  validate-rag.mjs
```

## 5. 当前已知限制

1. RAG 目前仍以轻量关键词检索为主，复杂问题命中率有限。
2. 联网/工具调用结果尚未结构化回传到前端。
3. 业务工具覆盖仍偏基础（仅 3 类查询）。

以上限制和后续计划见 `plan.md`。
