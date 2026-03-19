import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RAG_CONFIG } from '@/lib/agent/rag/config';
import { searchInternalKnowledge } from '@/lib/agent/rag/search-service';

export function createRagTools() {
  const searchKnowledgeBase = tool(
    async ({ query, topK }) => {
      const result = searchInternalKnowledge(query, topK);
      return JSON.stringify(result);
    },
    {
      name: 'search_internal_knowledge_base',
      description: '从内部 RAG 知识库中检索眼科相关文档。',
      schema: z.object({
        query: z.string().describe('检索问题或关键词'),
        topK: z
          .number()
          .min(1)
          .max(RAG_CONFIG.maxTopK)
          .default(RAG_CONFIG.defaultTopK),
      }),
    },
  );

  return [searchKnowledgeBase];
}
