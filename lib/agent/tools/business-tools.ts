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
    throw new Error(`Missing required environment variable: ${name}`);
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
      error instanceof Error ? error.message : 'Java backend is unavailable';
    return {
      ok: false,
      status: 503,
      error: `Failed to call Java backend: ${message}`,
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
      description:
        'Query patient case details by patient id from the existing Java backend.',
      schema: z.object({
        patientId: z.string().describe('The patient id in the hospital system'),
      }),
    },
  );

  const analyzePdf = tool(
    async ({ fileUrl, userQuestion }) => {
      const path = process.env.JAVA_PDF_ANALYZE_PATH ?? '/ai/pdf/analyze';
      const result = await callJavaApi(token, path, 'POST', {
        fileUrl,
        userQuestion,
      });
      return JSON.stringify(result);
    },
    {
      name: 'analyze_pdf_report',
      description:
        'Analyze an uploaded PDF report using existing Java backend capability and return summary.',
      schema: z.object({
        fileUrl: z.string().url().describe('The uploaded PDF URL to analyze'),
        userQuestion: z
          .string()
          .describe(
            'Optional focus question, for example: summarize diagnosis conclusion',
          )
          .default('Summarize the main diagnosis from this report.'),
      }),
    },
  );

  return [getPatientCaseById, analyzePdf];
}
