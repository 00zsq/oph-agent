import { tool } from '@langchain/core/tools';
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
    title: '糖尿病视网膜病变随访建议',
    source: '院内临床指南-v1',
    content:
      '对于无黄斑水肿的轻度非增殖性糖尿病视网膜病变，通常建议每 6 到 12 个月复查一次。',
  },
  {
    id: 'doc-2',
    title: '青光眼基础风险因素',
    source: '院内临床指南-v1',
    content: '重要风险因素包括眼压升高、家族史、年龄增长以及角膜偏薄。',
  },
  {
    id: 'doc-3',
    title: '医疗建议免责声明',
    source: '服务策略',
    content: 'AI 生成内容仅用于辅助决策，治疗决策前必须由执业临床医生审核。',
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
      description: '从内部 RAG 知识库中检索眼科相关文档。',
      schema: z.object({
        query: z.string().describe('检索问题或关键词'),
        topK: z.number().min(1).max(8).default(3),
      }),
    },
  );

  return [searchKnowledgeBase];
}
