export type SeedKnowledgeDoc = {
  id: string;
  title: string;
  source: string;
  publisher: string;
  year: number;
  version: string;
  url: string;
  sectionHint: string;
  summary: string;
  keywords: string[];
};

export type RagSearchHit = {
  id: string;
  title: string;
  source: string;
  publisher: string;
  year: number;
  version: string;
  url: string;
  sectionHint: string;
  summary: string;
  score: number;
  citation: string;
};

export type RagSearchResult = {
  query: string;
  topK: number;
  minScore: number;
  permissionScope: string;
  versionPriority: string;
  hits: RagSearchHit[];
  missHint?: string;
};
