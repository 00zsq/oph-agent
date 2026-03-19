import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { callJavaApi } from './java-api';

export function createAppointmentsTool(token?: string) {
  return tool(
    async () => {
      const path =
        process.env.JAVA_APPOINTMENTS_PATH ?? '/dsod/manage/appointment';
      const result = await callJavaApi(token, path, 'GET');
      return JSON.stringify(result);
    },
    {
      name: 'get_doctor_appointments',
      description: '获取医生预约列表。',
      schema: z.object({}),
    },
  );
}
