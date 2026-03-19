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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const modelName = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  return new ChatOpenAI({
    apiKey,
    modelName,
    temperature: 0.1,
  });
}

function buildSystemPrompt() {
  return [
    'You are an ophthalmology assistant for hospital workflows.',
    'Always prefer tool calls when user asks for patient data, PDF analysis, internal knowledge retrieval, or live web updates.',
    'Do not fabricate patient records. If tool data is missing, clearly state it and suggest next action.',
    'For medical output, include a short safety note to consult licensed clinicians.',
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

  return 'No response from model.';
}
