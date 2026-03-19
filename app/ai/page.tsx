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
    <main className="h-dvh w-full overflow-hidden bg-[#f3f4f6] p-3 md:p-4">
      <div className="h-full w-full">
        <AiAssistantClient token={token} />
      </div>
    </main>
  );
}
