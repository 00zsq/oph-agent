import { tool, type StructuredToolInterface } from '@langchain/core/tools';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { z } from 'zod';

type KnowledgeDoc = {
  id: string;
  title: string;
  source: string;
  content: string;
};

const KNOWLEDGE_BASE: KnowledgeDoc[] = [
  {
    id: 'doc-1',
    title: 'Diabetic Retinopathy Follow-up',
    source: 'internal-clinical-guide-v1',
    content:
      'For mild non-proliferative diabetic retinopathy without macular edema, follow-up is usually every 6 to 12 months.',
  },
  {
    id: 'doc-2',
    title: 'Glaucoma Basic Risk',
    source: 'internal-clinical-guide-v1',
    content:
      'Important risk factors include elevated intraocular pressure, family history, age, and thin cornea.',
  },
  {
    id: 'doc-3',
    title: 'Common Advice Disclaimer',
    source: 'service-policy',
    content:
      'AI generated content is for decision support only and must be reviewed by licensed clinicians before treatment decisions.',
  },
];

function scoreByKeywordOverlap(query: string, text: string): number {
  const q = query.toLowerCase().split(/\W+/).filter(Boolean);
  if (q.length === 0) {
    return 0;
  }

  const t = text.toLowerCase();
  let score = 0;
  for (const keyword of q) {
    if (t.includes(keyword)) {
      score += 1;
    }
  }

  return score / q.length;
}

export function createRagTools() {
  const searchKnowledgeBase = tool(
    async ({ query, topK }) => {
      const ranked = KNOWLEDGE_BASE.map((doc) => ({
        ...doc,
        score: scoreByKeywordOverlap(query, `${doc.title} ${doc.content}`),
      }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return JSON.stringify({
        query,
        hits: ranked,
      });
    },
    {
      name: 'search_internal_knowledge_base',
      description:
        'Search local ophthalmology documents from the internal RAG knowledge base.',
      schema: z.object({
        query: z.string().describe('Question or keywords for retrieval'),
        topK: z.number().min(1).max(8).default(3),
      }),
    },
  );

  const tools: StructuredToolInterface[] = [searchKnowledgeBase];

  if (process.env.TAVILY_API_KEY) {
    tools.push(
      new TavilySearchResults({
        maxResults: 3,
        apiKey: process.env.TAVILY_API_KEY,
        includeAnswer: true,
        includeRawContent: false,
      }),
    );
  } else {
    const webSearchFallback = tool(
      async ({ query }) => {
        return JSON.stringify({
          ok: false,
          reason:
            'TAVILY_API_KEY is not configured. Set TAVILY_API_KEY to enable live web search.',
          query,
        });
      },
      {
        name: 'search_web_live',
        description:
          'Search web for latest information. Returns setup hints if live search provider is not configured.',
        schema: z.object({
          query: z.string().describe('Web search query'),
        }),
      },
    );

    tools.push(webSearchFallback);
  }

  return tools;
}
