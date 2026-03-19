import seedDocs from '@/lib/agent/docs/knowledge-base.v1.json';
import { RAG_CONFIG } from './config';
import type { RagSearchHit, RagSearchResult, SeedKnowledgeDoc } from './types';

function normalizeTopK(topK?: number): number {
  if (!topK || Number.isNaN(topK)) {
    return RAG_CONFIG.defaultTopK;
  }
  return Math.min(Math.max(1, Math.floor(topK)), RAG_CONFIG.maxTopK);
}

function tokenize(query: string): string[] {
  const tokens = query.toLowerCase().match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]+/gi);

  if (!tokens) {
    return [];
  }

  return Array.from(new Set(tokens));
}

function scoreDoc(query: string, doc: SeedKnowledgeDoc): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return 0;
  }

  const text =
    `${doc.title} ${doc.summary} ${doc.sectionHint} ${doc.keywords.join(' ')}`.toLowerCase();

  let hit = 0;
  for (const token of tokens) {
    if (text.includes(token)) {
      hit += 1;
    }
  }

  if (text.includes(query.toLowerCase())) {
    hit += 1;
  }

  return hit / (tokens.length + 1);
}

function dedupeByUrl(docs: SeedKnowledgeDoc[]): SeedKnowledgeDoc[] {
  const seen = new Set<string>();
  const unique: SeedKnowledgeDoc[] = [];

  for (const doc of docs) {
    if (seen.has(doc.url)) {
      continue;
    }
    seen.add(doc.url);
    unique.push(doc);
  }

  return unique;
}

function toCitation(doc: SeedKnowledgeDoc): string {
  return `[${doc.title}@${doc.version}#${doc.sectionHint}]`;
}

export function searchInternalKnowledge(
  query: string,
  topK?: number,
): RagSearchResult {
  const limit = normalizeTopK(topK);
  const docs = dedupeByUrl(seedDocs as SeedKnowledgeDoc[]);

  const hits: RagSearchHit[] = docs
    .map((doc) => ({
      ...doc,
      score: scoreDoc(query, doc),
      citation: toCitation(doc),
    }))
    .filter((item) => item.score >= RAG_CONFIG.minScore)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.year - a.year;
    })
    .slice(0, limit);

  const result: RagSearchResult = {
    query,
    topK: limit,
    minScore: RAG_CONFIG.minScore,
    permissionScope: RAG_CONFIG.permissionScope,
    versionPriority: RAG_CONFIG.versionPriority,
    hits,
  };

  if (hits.length === 0) {
    result.missHint =
      '未命中相关临床知识库内容。建议补充疾病名称、检查项、患者分期或指南关键词后重试。';
  }

  return result;
}
