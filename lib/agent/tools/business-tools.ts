import { tool } from '@langchain/core/tools';
import { z } from 'zod';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JavaApiSuccess = {
  ok: true;
  status: number;
  data: JsonValue;
};

type JavaApiFailure = {
  ok: false;
  status: number;
  error: string;
};

type JavaApiResult = JavaApiSuccess | JavaApiFailure;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少必填环境变量：${name}`);
  }
  return value;
}

function resolveUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}

async function safeReadJson(response: Response): Promise<JsonValue | string> {
  const text = await response.text();
  if (!text) {
    return '';
  }

  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return text;
  }
}

async function callJavaApi(
  token: string | undefined,
  path: string,
  method: 'GET' | 'POST',
  payload?: Record<string, JsonValue>,
): Promise<JavaApiResult> {
  const baseUrl = getRequiredEnv('JAVA_API_BASE_URL');
  const url = new URL(resolveUrl(baseUrl, path));

  if (method === 'GET' && payload) {
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.authentication = token;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: method === 'POST' && payload ? JSON.stringify(payload) : undefined,
      cache: 'no-store',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Java 后端服务不可用';
    return {
      ok: false,
      status: 503,
      error: `调用 Java 后端失败：${message}`,
    };
  }

  const result = await safeReadJson(response);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: typeof result === 'string' ? result : JSON.stringify(result),
    };
  }

  return {
    ok: true,
    status: response.status,
    data: result as JsonValue,
  };
}

export function createBusinessTools(token?: string) {
  const getPatientCaseById = tool(
    async ({ patientId }) => {
      const path =
        process.env.JAVA_PATIENT_CASE_PATH ?? '/patient/getPatientById';
      const result = await callJavaApi(token, path, 'GET', { patientId });
      return JSON.stringify(result);
    },
    {
      name: 'get_patient_case_by_id',
      description: '根据患者 ID 从现有 Java 后端查询病例详情。',
      schema: z.object({
        patientId: z.string().describe('医院系统中的患者 ID'),
      }),
    },
  );

  return [getPatientCaseById];
}
