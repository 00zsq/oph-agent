import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent';
import type { BusinessToolAction } from '@/lib/agent/tools/business';

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
      enableWebSearch?: boolean;
      allowBusinessToolCall?: boolean;
      preferredBusinessAction?: BusinessToolAction;
    };

    const question = body.question?.trim();
    if (!question) {
      return NextResponse.json({ error: '问题不能为空' }, { status: 400 });
    }

    const token = getBearerToken(request, body.token);
    const threadId = body.threadId?.trim() || crypto.randomUUID();

    const answer = await runAgent({
      token,
      threadId,
      question,
      enableWebSearch: body.enableWebSearch,
      allowBusinessToolCall: body.allowBusinessToolCall,
      preferredBusinessAction: body.preferredBusinessAction,
    });

    return NextResponse.json({
      threadId,
      data: answer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知服务端错误';

    return NextResponse.json(
      {
        error: 'AI 智能体处理失败',
        detail: message,
      },
      { status: 500 },
    );
  }
}
