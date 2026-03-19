import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent';

export const runtime = 'nodejs';

function getBearerToken(
  request: NextRequest,
  bodyToken?: string,
): string | undefined {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }

  const legacy = request.headers.get('authentication');
  if (legacy) {
    return legacy;
  }

  return bodyToken;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      question?: string;
      token?: string;
      threadId?: string;
    };

    const question = body.question?.trim();
    if (!question) {
      return NextResponse.json(
        { error: 'question is required' },
        { status: 400 },
      );
    }

    const token = getBearerToken(request, body.token);
    const threadId = body.threadId?.trim() || crypto.randomUUID();

    const answer = await runAgent({
      token,
      threadId,
      question,
    });

    return NextResponse.json({
      threadId,
      data: answer,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown server error';

    return NextResponse.json(
      {
        error: 'AI agent failed',
        detail: message,
      },
      { status: 500 },
    );
  }
}
