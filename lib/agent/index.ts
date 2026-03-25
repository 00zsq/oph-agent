import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createBusinessTools } from './tools/business';
import type { BusinessToolAction } from './tools/business';
import { createRagTools } from './tools/rag-tools';

type AgentRequest = {
  token?: string;
  threadId: string;
  question: string;
  enableWebSearch?: boolean;
  allowBusinessToolCall?: boolean;
  preferredBusinessAction?: BusinessToolAction;
};

const CITATION_PATTERN = /\[[^\[\]@]+@[^\[\]#]+#[^\[\]]+\]/g;

// 将消息内容转换为纯文本，适用于字符串或包含文本字段的对象数组
function toMessageText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

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

// 从消息数组中提取所有符合引用格式的字符串，支持直接文本和嵌套在JSON中的引用
function extractCitationsFromMessages(messages: unknown[]): string[] {
  const citations = new Set<string>();

  for (const message of messages) {
    if (!message || typeof message !== 'object' || !('content' in message)) {
      continue;
    }

    const text = toMessageText((message as { content?: unknown }).content);
    if (!text) {
      continue;
    }

    const directMatches = text.match(CITATION_PATTERN);
    if (directMatches) {
      for (const value of directMatches) {
        citations.add(value);
      }
    }

    if (!text.includes('"hits"')) {
      continue;
    }

    try {
      const parsed = JSON.parse(text) as {
        hits?: Array<{ citation?: string }>;
      };

      if (!Array.isArray(parsed.hits)) {
        continue;
      }

      for (const hit of parsed.hits) {
        if (hit?.citation && hit.citation.match(CITATION_PATTERN)) {
          citations.add(hit.citation);
        }
      }
    } catch {
      // 忽略解析错误，继续处理下一条消息
    }
  }

  return Array.from(citations);
}

// 如果答案中已经包含引用格式，或者没有新的引用，则直接返回原答案；否则在答案末尾添加引用列表
function enforceCitationFormat(answer: string, citations: string[]): string {
  if (!answer.trim()) {
    return answer;
  }

  if (answer.match(CITATION_PATTERN)) {
    return answer;
  }

  if (citations.length === 0) {
    return answer;
  }

  const citationLines = citations.map((item) => `- ${item}`).join('\n');
  return `${answer}\n\n参考来源：\n${citationLines}`;
}

let promptCache: string | null = null;

// 加载系统提示词，优先从环境变量指定的路径加载，失败时使用默认提示词，并缓存结果以避免重复读取文件
async function loadSystemPrompt() {
  if (promptCache) {
    return promptCache;
  }

  const defaultPath = join(
    process.cwd(),
    'lib',
    'agent',
    'docs',
    'medical-response-policy.v1.md',
  );
  const path = process.env.AGENT_SYSTEM_PROMPT_PATH || defaultPath;

  try {
    promptCache = await readFile(path, 'utf-8');
    return promptCache;
  } catch {
    promptCache =
      '你是眼科智能助手。请严格依据知识库与工具结果作答，禁止编造；未命中时明确说明未命中；所有医疗建议仅供参考并需由执业医生判断。';
    return promptCache;
  }
}

// 根据环境变量配置创建语言模型实例，支持启用思考链和联网搜索功能，并允许前端强制控制联网开关以确保隐私安全
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
  // 环境变量优先级：前端接口参数 > 环境变量，确保前端配置的联网开关能够覆盖环境变量设置，满足用户隐私保护需求
  const enableThinking =
    (process.env.QWEN_ENABLE_THINKING ?? 'false').toLowerCase() === 'true';
  // 联网开关
  const enableSearchByEnv =
    (process.env.QWEN_ENABLE_SEARCH ?? 'true').toLowerCase() === 'true';
  const enableSearch = enableWebSearch ?? enableSearchByEnv;
  // 强制联网
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

// 主函数：根据请求参数配置模型和工具，加载提示词，创建Agent实例并执行查询，最后处理模型输出以确保包含正确的引用格式
export async function runAgent(req: AgentRequest): Promise<string> {
  const model = getModel(req.enableWebSearch);
  const businessTools = req.allowBusinessToolCall
    ? createBusinessTools(
        req.token,
        req.preferredBusinessAction ? [req.preferredBusinessAction] : undefined,
      )
    : [];
  const tools = [...businessTools, ...createRagTools()];
  const prompt = await loadSystemPrompt();

  const runtimePrompt = req.allowBusinessToolCall
    ? req.preferredBusinessAction
      ? `${prompt}

本轮任务说明：必须优先调用业务工具完成查询，且仅可使用当前允许的业务工具。请先调用工具，再基于工具结果输出结论。`
      : `${prompt}

本轮任务说明：允许调用业务工具，请优先工具查询后再回答。`
    : `${prompt}

本轮任务说明：禁止调用业务工具，仅可进行普通问答与知识检索。`;

  const agent = createReactAgent({
    llm: model,
    tools,
    prompt: runtimePrompt,
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
  const citations = extractCitationsFromMessages(result.messages as unknown[]);

  if (typeof content === 'string') {
    return enforceCitationFormat(content, citations);
  }

  if (Array.isArray(content)) {
    const answer = toMessageText(content);
    return enforceCitationFormat(answer, citations);
  }

  return '模型未返回有效内容。';
}
