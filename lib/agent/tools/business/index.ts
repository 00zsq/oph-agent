import type { StructuredToolInterface } from '@langchain/core/tools';
import { createAppointmentsTool } from './appointments';
import { createDiagnosisHistoryTool } from './diagnosis-history';
import { createPatientListTool } from './patient-list';
import type { BusinessToolAction } from './types';

export type { BusinessToolAction } from './types';

export function createBusinessTools(
  token?: string,
  actions?: BusinessToolAction[],
): StructuredToolInterface[] {
  const patientList = createPatientListTool(token);
  const diagnosisHistory = createDiagnosisHistoryTool(token);
  const appointments = createAppointmentsTool(token);

  const allTools = [patientList, diagnosisHistory, appointments];

  const actionMap: Record<BusinessToolAction, StructuredToolInterface> = {
    patient_list: patientList,
    diagnosis_history: diagnosisHistory,
    appointments,
  };

  if (!actions || actions.length === 0) {
    return allTools;
  }

  return actions.map((action) => actionMap[action]).filter(Boolean);
}
