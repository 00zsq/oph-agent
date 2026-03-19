import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createBusinessTools } from './tools/business-tools';
import { createRagTools } from './tools/rag-tools';

type AgentRequest = {
  token?: string;
  threadId: string;
  question: string;
  enableWebSearch?: boolean;
};

const CITATION_PATTERN = /\[[^\[\]@]+@[^\[\]#]+#[^\[\]]+\]/g;

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
      // ignore parse failures for non-json text
    }
  }

  return Array.from(citations);
}

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
    // Fallback prompt keeps service available if prompt file is missing.
    promptCache =
      '你是眼科智能助手。请严格依据知识库与工具结果作答，禁止编造；未命中时明确说明未命中；所有医疗建议仅供参考并需由执业医生判断。';
    return promptCache;
  }
}

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

export async function runAgent(req: AgentRequest): Promise<string> {
  const model = getModel(req.enableWebSearch);
  const tools = [...createBusinessTools(req.token), ...createRagTools()];
  const prompt = await loadSystemPrompt();

  const agent = createReactAgent({
    llm: model,
    tools,
    prompt,
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
