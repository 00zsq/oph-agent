# Oph Agent 实施计划（当前版本）

## 0. 目标范围

本阶段聚焦 3 条能力链路：

1. 普通问答：LLM + Web 检索 + RAG 知识库检索，返回文本答案。
2. Function 调用：在 AI 页面触发工具调用 Java 后端接口并返回结构化信息（如病例列表/详情）。
3. 质量保障：批量评测问答命中率与引用完整率，持续改进 RAG。

---

## 1. 你需要提供的资源清单

## 1.1 必需资源（没有这些无法完整落地）

1. 模型与密钥

- OPENAI_API_KEY（或 DASHSCOPE_API_KEY）
- 可选模型名（默认 qwen3.5-plus）

2. Java 后端接口文档（至少要有以下内容）

- 接口路径、HTTP 方法、请求参数、响应示例、错误码
- 鉴权方式（authentication 头或 Authorization Bearer）
- 分页字段规范（pageNum/pageSize/total/list 等）

3. 业务接口清单（第一批建议）

- 查询病人病例列表
- 查询病人详情/病例详情
- （可选）按条件检索病例（时间、科室、诊断标签）

4. RAG 数据源

- 知识文档原始来源（指南、制度、FAQ、病例模板）
- 文档更新频率和负责人
- 权限要求（医生端默认全可见）

## 1.2 强烈建议提供（影响效果与上线质量）

1. 医疗安全输出规范

- 禁止建议用语
- 必须追加的免责声明模板
- 高风险问答（诊断/用药）兜底文案

2. 评测样本集

- 至少 30 条问答（普通问答、工具调用、时效性问答）
- 每条包含“期望答案要点”

3. 观测与审计要求

- 是否记录原始问题、工具调用参数、工具返回、最终答案
- 敏感字段脱敏规则

---

## 2. 当前代码基线（已具备）

1. Agent 入口与规则文档加载

- lib/agent/index.ts
- lib/agent/docs/medical-response-policy.v1.md

2. RAG 解耦模块

- lib/agent/docs/knowledge-base.v1.json
- lib/agent/rag/config.ts
- lib/agent/rag/search-service.ts
- lib/agent/tools/rag-tools.ts

3. 业务工具与 API

- lib/agent/tools/business-tools.ts（病例查询）
- app/api/chat/route.ts

4. 评测脚本

- scripts/validate-rag.mjs
- lib/agent/docs/rag-eval-qa.v1.json

结论：骨架已可用，下一步重点是“检索质量 + 工具覆盖 + 评测闭环”。

---

## 3. 架构图（当前目标态）

```mermaid
flowchart TD
    U[Vue 页面 iframe] --> A[/ai 聊天页]
    A --> C[/api/chat]

    C --> G[LangGraph Agent Graph]

    G --> N1[意图识别节点 Intent Router]
    N1 -->|普通问答| N2[RAG 检索节点]
    N1 -->|需要最新信息| N3[Web 检索能力]
    N1 -->|业务数据查询| N4[Function Tool 节点]

    N2 --> N5[答案综合节点]
    N3 --> N5
    N4 --> N5

    N5 --> N6[安全审校节点]
    N6 --> C

    N4 --> J[Java Backend APIs]
```

---

## 4. 技术栈建议（结合当前项目）

## 4.1 已在用

1. Next.js 16 + App Router
2. LangChain 0.3 生态 + LangGraph 0.2
3. Qwen/OpenAI 兼容 Chat 模型
4. Zod（工具参数校验）

## 4.2 建议补充

1. 向量检索

- 方案 A（快）：pgvector + Postgres
- 方案 B（托管）：Pinecone/Milvus

2. 检索增强

- 混合检索（关键词 + 向量）
- 重排（re-rank）

3. 可观测

- LangSmith（链路追踪）或自建日志
- 统一 traceId（threadId + requestId）

4. 缓存与会话

- Redis（可选）存会话摘要、工具结果短缓存

---

## 5. LangGraph 节点设计（第一版）

## 5.1 节点列表

1. intent_router

- 输入：user question + 会话上下文
- 输出：route = chat | function

2. retrieve_rag

- 仅在 route=chat/function 辅助时执行
- 输出：topK 文档片段 + citation

3. retrieve_web

- 仅在“时效性问题”执行
- 输出：网页摘要 + 来源提示

4. call_business_tools

- route=function 时执行
- 调用 Java API 工具（病例列表、详情等）

5. synthesize_answer

- 汇总 RAG/Web/Tool 结果，生成可读答案

6. safety_guard

- 统一加医疗安全声明、敏感内容检查

## 5.2 路由策略（可先规则后模型）

1. 若命中关键词（病例、患者、列表、查询、病历号）=> function
2. 其余 => chat
3. chat 下再判断是否需要 web（如“最新指南/最近/今年”）

---

## 6. 分阶段实现步骤

## 阶段 A：Function 完善

1. 扩展工具

- 在 business-tools.ts 增加 get_patient_case_list 等工具
- 每个工具单独 zod schema + 明确 description

2. 统一 Java 返回适配

- 规范成功/失败结构
- 对分页数据做标准化（items/total/page/size）

3. 验收

- 输入“帮我查询病人病例列表”可稳定触发工具
- 返回可读摘要 + 原始关键字段

## 阶段 B：RAG 提升

1. ingestion 脚本

- 文档切分、向量化、入库

2. 替换轻量检索

- 从向量库检索，不再只依赖关键词

3. 引用与可解释

- 答案强制附带 citation（[文档标题@版本号#章节]）

4. 验收

- 30 条内部知识问答命中率达到目标（如 >80%）

## 阶段 C：Web 检索增强

1. 启用模型原生联网能力

- QWEN_ENABLE_SEARCH / QWEN_FORCED_SEARCH

2. 时效性判定

- 仅在必要时调用 web，控制成本

3. 多源冲突处理

- 优先内部指南 > 官方机构 > 其他来源

4. 验收

- “最新指南/近期研究”问题有来源提示且不胡编

## 阶段 D：稳定性与上线

1. 错误处理

- 明确区分配置错误、网络错误、后端业务错误
- 前端展示友好报错（例如缺少模型密钥）

2. 观测与审计

- 记录每次工具调用耗时、参数摘要、状态码

3. 安全

- token 透传策略审计
- 敏感字段脱敏日志

4. 回归测试

- API 契约测试 + 关键对话 E2E

---

## 7. 本周可执行最小里程碑（建议）

1. Day 1-2

- 完成病例列表工具 + Agent 路由规则

2. Day 3-4

- 接入真实向量库并替换轻量 RAG 检索

3. Day 5

- 扩充评测集并跑批量评测，优化命中率与引用完整率

里程碑完成定义：

- 三类请求（普通问答、函数调用、时效性问答）各至少 10 条用例通过。

---

## 8. 你下一步先给我什么（按优先级）

1. Java “病例列表/详情”接口文档（路径、参数、响应示例）
2. 计划使用的向量库方案（pgvector 或 Pinecone/Milvus）
3. 扩展知识库文档（至少 30 篇）
4. 一份可脱敏测试数据（至少 5 个病人示例）

拿到以上 4 项后，可以立即开始阶段 A 与阶段 B 的代码实现。
