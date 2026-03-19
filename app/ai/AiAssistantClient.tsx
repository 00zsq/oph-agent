'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type Props = {
  token?: string;
};

type BusinessAction = 'patient_list' | 'diagnosis_history' | 'appointments';

type SendOptions = {
  allowBusinessToolCall: boolean;
  preferredBusinessAction?: BusinessAction;
};

const QUICK_ACTIONS: Array<{
  key: BusinessAction;
  label: string;
  question: string;
}> = [
  {
    key: 'patient_list',
    label: '查询患者列表',
    question: '请帮我查询当前患者列表（第1页，每页10条），并按要点总结。',
  },
  {
    key: 'diagnosis_history',
    label: '查询诊断记录',
    question: '请帮我查询全部诊断记录（第1页，每页10条），并总结关键信息。',
  },
  {
    key: 'appointments',
    label: '查询预约管理',
    question: '请帮我查询当前医生预约列表，并按待处理优先级总结。',
  },
];

const TYPEWRITER_DELAY_MS = 16;
const TYPEWRITER_CHUNK_SIZE = 2;

export default function AiAssistantClient({ token }: Props) {
  const [threadId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '您好，我是您的AI助手，有什么可以帮您的吗？',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading && !typing,
    [input, loading, typing],
  );

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, typing]);

  async function appendAssistantMessageWithTypewriter(fullText: string) {
    const id = crypto.randomUUID();
    const chars = Array.from(fullText);
    setTyping(true);
    setMessages((prev) => [...prev, { id, role: 'assistant', content: '' }]);

    for (
      let i = TYPEWRITER_CHUNK_SIZE;
      i <= chars.length;
      i += TYPEWRITER_CHUNK_SIZE
    ) {
      const nextText = chars.slice(0, i).join('');
      setMessages((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, content: nextText } : item,
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, TYPEWRITER_DELAY_MS));
    }

    setMessages((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, content: chars.join('') } : item,
      ),
    );
    setTyping(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    const question = input.trim();
    setInput('');
    await sendQuestion(question, { allowBusinessToolCall: false });
  }

  async function sendQuestion(question: string, options: SendOptions) {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authentication: token } : {}),
        },
        body: JSON.stringify({
          question,
          threadId,
          enableWebSearch,
          allowBusinessToolCall: options.allowBusinessToolCall,
          preferredBusinessAction: options.preferredBusinessAction,
        }),
      });

      const data = (await response.json()) as {
        data?: string;
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(data.detail || data.error || '请求失败');
      }

      const answer = data.data || '抱歉，我无法理解您的问题。';
      setLoading(false);
      await appendAssistantMessageWithTypewriter(answer);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `请求失败，请稍后再试。错误类型：${message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function onQuickAction(action: (typeof QUICK_ACTIONS)[number]) {
    if (loading || typing) {
      return;
    }

    await sendQuestion(action.question, {
      allowBusinessToolCall: true,
      preferredBusinessAction: action.key,
    });
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,hsl(0,0%,100%),hsl(235,44%,95%),hsl(223,100%,94%),hsl(226,78%,87%))] shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
      <div className="border-b border-white/40 bg-white/45 px-5 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-slate-800">
              眼科智能助手
            </h1>
            <p className="text-xs text-slate-500">支持问答与病例查询</p>
          </div>
          <button
            type="button"
            onClick={() => setEnableWebSearch((prev) => !prev)}
            disabled={loading || typing}
            className={`h-8 rounded-full border px-3 text-xs font-medium transition ${
              enableWebSearch
                ? 'border-[#1890ff] bg-[#eaf4ff] text-[#0e66b7]'
                : 'border-slate-300 bg-white text-slate-500'
            } disabled:cursor-not-allowed disabled:opacity-60`}
            aria-pressed={enableWebSearch}
          >
            联网：{enableWebSearch ? '开启' : '关闭'}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-[18px] overflow-y-auto px-5 py-5 [scrollbar-width:thin] [scrollbar-color:#c1c1c1_#f1f1f1]">
        {messages.map((message) => (
          <div key={message.id} className="flex max-w-full items-start gap-3">
            {message.role === 'user' ? (
              <>
                <div className="ml-auto max-w-[70%] break-words rounded-[12px_12px_0_12px] bg-[#1890ff] px-4 py-3 text-sm leading-6 text-white">
                  {message.content}
                </div>
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
                  <Image
                    src="/OIP-C.jpg"
                    alt="用户头像"
                    fill
                    sizes="40px"
                    className="object-cover"
                    priority={message.id === messages[0]?.id}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
                  <Image
                    src="/XF.jpg"
                    alt="AI头像"
                    fill
                    sizes="40px"
                    className="object-cover"
                    priority={message.id === messages[0]?.id}
                  />
                </div>
                <div className="max-w-[70%] break-words rounded-[12px_12px_12px_0] bg-white px-4 py-3 text-sm leading-6 text-[#333333] shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="mb-2 text-base font-semibold">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="mb-2 text-[15px] font-semibold">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="mb-1 text-sm font-semibold">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="mb-2 last:mb-0">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => <li>{children}</li>,
                      hr: () => <hr className="my-3 border-slate-200" />,
                      table: ({ children }) => (
                        <div className="my-2 overflow-x-auto">
                          <table className="min-w-full border-collapse text-xs">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-slate-50">{children}</thead>
                      ),
                      th: ({ children }) => (
                        <th className="border border-slate-200 px-2 py-1 text-left font-semibold">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-slate-200 px-2 py-1 align-top">
                          {children}
                        </td>
                      ),
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#0e66b7] underline"
                        >
                          {children}
                        </a>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      code: ({ children }) => (
                        <code className="rounded bg-slate-100 px-1 py-[1px] text-xs">
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              </>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
              <Image
                src="/XF.jpg"
                alt="AI头像"
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <div className="rounded-[12px_12px_12px_0] bg-white px-4 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
              正在思考中...
            </div>
          </div>
        )}
        <div ref={messageEndRef} />
      </div>

      <div className="bg-white px-5 pt-3 pb-2 shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
        <div className="mb-2 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => onQuickAction(action)}
              disabled={loading || typing}
              className="rounded-full border border-[#c8dcff] bg-[#f2f7ff] px-3 py-1 text-xs font-medium text-[#0e66b7] transition hover:bg-[#e8f1ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="flex items-center gap-0">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="请输入消息..."
            className="h-11 flex-1 rounded-l-[20px] rounded-r-none border border-r-0 border-slate-200 bg-white px-5 text-sm text-slate-900 outline-none focus:border-[#1890ff]"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="h-11 rounded-r-[20px] rounded-l-none border border-[#1890ff] bg-[#1890ff] px-5 text-sm font-medium text-white transition hover:bg-[#3a9cff] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
          >
            {loading ? '发送中...' : typing ? '输出中...' : '发送'}
          </button>
        </form>
      </div>
    </div>
  );
}
