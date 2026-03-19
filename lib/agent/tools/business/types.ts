export type BusinessToolAction =
  | 'patient_list'
  | 'diagnosis_history'
  | 'appointments';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JavaApiSuccess = {
  ok: true;
  status: number;
  data: JsonValue;
};

export type JavaApiFailure = {
  ok: false;
  status: number;
  error: string;
};

export type JavaApiResult = JavaApiSuccess | JavaApiFailure;
