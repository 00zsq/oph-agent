import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createBusinessTools } from './tools/business-tools';
import { createRagTools } from './tools/rag-tools';

type AgentRequest = {
  token?: string;
  threadId: string;
  question: string;
};

function getModel() {
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

  return new ChatOpenAI({
    apiKey,
    modelName,
    configuration: {
      baseURL,
    },
    ...(enableThinking
      ? {
          modelKwargs: {
            enable_thinking: true,
          },
        }
      : {}),
    temperature: 0.1,
  });
}

function buildSystemPrompt() {
  return [
    '你是面向医院业务流程的眼科智能助手。',
    '当用户需要病例数据、PDF分析、内部知识检索或联网信息时，优先调用工具，不要直接臆测。',
    '严禁编造患者记录；如果工具没有返回数据，必须明确说明并给出下一步建议。',
    '所有医疗相关回答都要附带简短安全提示：最终请由执业医生判断。',
  ].join(' ');
}

export async function runAgent(req: AgentRequest): Promise<string> {
  const model = getModel();
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
