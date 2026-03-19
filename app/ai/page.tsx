import AiAssistantClient from './AiAssistantClient';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

export default async function AiPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tokenParam = params.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  return (
    <main className="h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white p-3 md:p-4">
      <AiAssistantClient token={token} />
    </main>
  );
}
