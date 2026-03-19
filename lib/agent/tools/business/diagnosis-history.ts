import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { callJavaApi } from './java-api';

export function createDiagnosisHistoryTool(token?: string) {
  return tool(
    async ({ page, pageSize }) => {
      const path =
        process.env.JAVA_DIAGNOSIS_HISTORY_PATH ?? '/dsod/manage/page/history';
      const result = await callJavaApi(token, path, 'GET', {
        name: '',
        sex: '',
        idCard: '',
        page,
        pageSize,
      });
      return JSON.stringify(result);
    },
    {
      name: 'get_diagnosis_history',
      description: '获取全部诊断记录（分页）。',
      schema: z.object({
        page: z.number().int().min(1).default(1).describe('页码，从 1 开始'),
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(10)
          .describe('每页数量，建议 10'),
      }),
    },
  );
}
