import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const base = process.env.JAVA_API_BASE_URL;
  const uploadPath = process.env.JAVA_PDF_UPLOAD_PATH ?? '/ai/pdf/upload';

  if (!base) {
    return NextResponse.json(
      {
        error: '未配置 JAVA_API_BASE_URL',
      },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const token =
    request.headers.get('authentication') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    '';

  const response = await fetch(new URL(uploadPath, base).toString(), {
    method: 'POST',
    headers: token ? { authentication: token } : undefined,
    body: formData,
    cache: 'no-store',
  });

  const text = await response.text();

  try {
    const data = text ? JSON.parse(text) : null;
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        raw: text,
      },
      { status: response.status },
    );
  }
}
