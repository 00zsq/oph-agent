export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-6 bg-white p-8">
      <h1 className="text-3xl font-bold text-slate-900">眼科智能体服务</h1>
      <p className="text-slate-600">
        该 Next.js 服务提供 SSR AI 助手页面与基于 LangGraph 的智能体 API，
        可在不改动现有 Java 业务接口的前提下接入智能问答与工具调用能力。
      </p>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-800">快速入口</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>
            助手页面：{' '}
            <a className="text-blue-600" href="/ai">
              /ai
            </a>
          </li>
          <li>
            聊天接口：<code>/api/chat</code>
          </li>
          <li>
            PDF 代理接口：<code>/api/pdf</code>
          </li>
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 p-5">
        <p className="text-sm font-semibold text-slate-800">Iframe 嵌入示例</p>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
          {`<iframe
  src="http://localhost:3000/ai?token=YOUR_TOKEN"
  style="width:100%;height:100%;border:0;"
  allow="clipboard-read; clipboard-write"
/>`}
        </pre>
      </div>
    </main>
  );
}
