export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-6 bg-white p-8">
      <h1 className="text-3xl font-bold text-slate-900">Oph Agent Service</h1>
      <p className="text-slate-600">
        This Next.js service provides an SSR AI assistant page and a
        LangGraph-powered agent API while keeping existing Java business APIs
        unchanged.
      </p>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-800">Quick links</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>
            Assistant page:{' '}
            <a className="text-blue-600" href="/ai">
              /ai
            </a>
          </li>
          <li>
            Chat API: <code>/api/chat</code>
          </li>
          <li>
            PDF proxy API: <code>/api/pdf</code>
          </li>
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 p-5">
        <p className="text-sm font-semibold text-slate-800">
          Iframe embed example
        </p>
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
