import AiPageClient from './AiPageClient';

export const dynamic = 'force-dynamic';

export default function AiPage() {
  return (
    <main className="h-dvh min-h-full w-full overflow-hidden bg-[#f3f4f6]">
      <AiPageClient />
    </main>
  );
}
