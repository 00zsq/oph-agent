import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { callJavaApi } from './java-api';

export function createPatientListTool(token?: string) {
  return tool(
    async ({ page, pageSize }) => {
      const path =
        process.env.JAVA_PATIENT_LIST_PATH ??
        '/dsod/manage/page/allpatientlist';
      const result = await callJavaApi(token, path, 'GET', {
        name: '',
        idCard: '',
        sex: '',
        lage: '',
        rage: '',
        page,
        pageSize,
      });
      return JSON.stringify(result);
    },
    {
      name: 'get_patient_list',
      description: '获取患者列表（分页）。',
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
