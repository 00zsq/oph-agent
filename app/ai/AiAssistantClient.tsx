'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type Props = {
  token?: string;
};

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
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading,
    [input, loading],
  );

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    const question = input.trim();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
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
        }),
      });

      const data = (await response.json()) as {
        data?: string;
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(data.detail || data.error || 'request failed');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.data || '抱歉，我无法理解您的问题。',
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,hsl(0,0%,100%),hsl(235,44%,95%),hsl(223,100%,94%),hsl(226,78%,87%))] shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
      <div className="border-b border-white/40 bg-white/45 px-5 py-4 backdrop-blur-sm">
        <h1 className="text-base font-semibold text-slate-800">眼科智能助手</h1>
        <p className="text-xs text-slate-500">支持问答、病例查询与PDF分析</p>
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
                  {message.content}
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

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-0 bg-white px-5 py-4 shadow-[0_-2px_12px_rgba(0,0,0,0.05)]"
      >
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
          {loading ? '发送中...' : '发送'}
        </button>
      </form>
    </div>
  );
}
