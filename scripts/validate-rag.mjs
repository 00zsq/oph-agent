import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const endpoint = process.env.CHAT_API_URL || 'http://localhost:3000/api/chat';
const qaPath =
  process.env.RAG_EVAL_QA_PATH ||
  join(process.cwd(), 'lib', 'agent', 'docs', 'rag-eval-qa.v1.json');

const citationPattern = /\[[^\[\]@]+@[^\[\]#]+#[^\[\]]+\]/g;
const missPattern = /未命中相关临床知识库内容/;

async function loadQuestions() {
  const raw = await readFile(qaPath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('问答集为空或格式不正确。');
  }
  return parsed;
}

function evaluateAnswer(answer) {
  const citations = answer.match(citationPattern) || [];
  const hit = !missPattern.test(answer) && citations.length > 0;
  const citationComplete = hit && citations.length > 0;
  return {
    hit,
    citationComplete,
    citations,
  };
}

async function ask(question, idx) {
  const body = {
    question,
    threadId: `rag-eval-${Date.now()}-${idx}`,
    enableWebSearch: false,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || data?.error || '接口请求失败');
  }

  return String(data?.data || '');
}

async function main() {
  const qaList = await loadQuestions();

  let hitCount = 0;
  let citationCompleteCount = 0;

  console.log(`开始执行 RAG 校验，共 ${qaList.length} 条问答...`);

  for (let i = 0; i < qaList.length; i += 1) {
    const item = qaList[i];
    const answer = await ask(item.question, i + 1);
    const result = evaluateAnswer(answer);

    if (result.hit) {
      hitCount += 1;
    }
    if (result.citationComplete) {
      citationCompleteCount += 1;
    }

    console.log('----------------------------------------');
    console.log(`${item.id} ${item.question}`);
    console.log(`命中: ${result.hit ? '是' : '否'}`);
    console.log(`引用完整: ${result.citationComplete ? '是' : '否'}`);
    console.log(`引用数量: ${result.citations.length}`);
    if (result.citations.length > 0) {
      console.log(`引用列表: ${result.citations.join(' | ')}`);
    }
  }

  const hitRate = ((hitCount / qaList.length) * 100).toFixed(2);
  const citationRate = ((citationCompleteCount / qaList.length) * 100).toFixed(
    2,
  );

  console.log('========================================');
  console.log(`总题数: ${qaList.length}`);
  console.log(`命中数: ${hitCount}`);
  console.log(`命中率: ${hitRate}%`);
  console.log(`引用完整数: ${citationCompleteCount}`);
  console.log(`引用完整率: ${citationRate}%`);
}

main().catch((error) => {
  console.error('RAG 校验失败:', error.message);
  process.exit(1);
});
