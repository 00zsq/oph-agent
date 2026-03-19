import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createBusinessTools } from './tools/business-tools';
import { createRagTools } from './tools/rag-tools';

type AgentRequest = {
  token?: string;
  threadId: string;
  question: string;
  enableWebSearch?: boolean;
};

function getModel(enableWebSearch?: boolean) {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('缺少模型密钥：请配置 OPENAI_API_KEY 或 DASHSCOPE_API_KEY');
  }

  const modelName = process.env.OPENAI_MODEL ?? 'qwen3.5-plus';
  const baseURL =
    process.env.OPENAI_BASE_URL ??
    process.env.DASHSCOPE_BASE_URL ??
    'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const enableThinking =
    (process.env.QWEN_ENABLE_THINKING ?? 'false').toLowerCase() === 'true';
  const enableSearchByEnv =
    (process.env.QWEN_ENABLE_SEARCH ?? 'true').toLowerCase() === 'true';
  const enableSearch = enableWebSearch ?? enableSearchByEnv;
  const forcedSearch =
    (process.env.QWEN_FORCED_SEARCH ?? 'false').toLowerCase() === 'true';

  const modelKwargs: Record<string, unknown> = {};
  if (enableThinking) {
    modelKwargs.enable_thinking = true;
  }
  // 按用户选择强制设置联网开关，确保前端关闭时不会联网。
  modelKwargs.enable_search = enableSearch;

  if (enableSearch && forcedSearch) {
    modelKwargs.search_options = { forced_search: true };
  }

  return new ChatOpenAI({
    apiKey,
    modelName,
    configuration: {
      baseURL,
    },
    ...(Object.keys(modelKwargs).length > 0 ? { modelKwargs } : {}),
    temperature: 0.1,
  });
}

function buildSystemPrompt() {
  return [
    '你是面向医院业务流程的眼科智能助手。',
    '当用户需要病例数据、PDF分析、内部知识检索时，优先调用工具，不要直接臆测。',
    '当问题需要最新公开信息时，优先使用模型内置联网搜索能力，并在回答中说明信息来源是联网检索。',
    '严禁编造患者记录；如果工具没有返回数据，必须明确说明并给出下一步建议。',
    '所有医疗相关回答都要附带简短安全提示：最终请由执业医生判断。',
  ].join(' ');
}

export async function runAgent(req: AgentRequest): Promise<string> {
  const model = getModel(req.enableWebSearch);
  const tools = [...createBusinessTools(req.token), ...createRagTools()];

  const agent = createReactAgent({
    llm: model,
    tools,
    prompt: buildSystemPrompt(),
    name: 'oph-agent',
  });

  const result = await agent.invoke(
    {
      messages: [
        {
          role: 'user',
          content: req.question,
        },
      ],
    },
    {
      configurable: {
        thread_id: req.threadId,
      },
    },
  );

  const final = result.messages[result.messages.length - 1];
  const content = final?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (item && typeof item === 'object' && 'text' in item) {
          return String(item.text);
        }

        return '';
      })
      .join('\n')
      .trim();
  }

  return '模型未返回有效内容。';
}
