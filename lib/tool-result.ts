export type ToolFailureCode =
  | 'UNAVAILABLE'
  | 'PERMISSION_DENIED'
  | 'INVALID_INPUT'
  | 'TIMEOUT'
  | 'PARTIAL_SUCCESS'
  | 'INVALID_OUTPUT'
  | 'NO_EFFECT'
  | 'RUNTIME_ERROR';

export type ToolResult<T = unknown> = {
  ok: boolean;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  data?: T;
  errorCode?: ToolFailureCode;
  message: string;
  retryable: boolean;
  partialOutputs?: unknown[];
  expectedState?: unknown;
  actualState?: unknown;
  safeNextAction?: string;
};

function stable(value: unknown): string {
  if (value === undefined) return 'undefined';
  try { return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort()); }
  catch { return String(value); }
}

export function verifyToolOutcome<T>(input: {
  data?: T;
  expectedState?: unknown;
  actualState?: unknown;
  error?: unknown;
  permissionDenied?: boolean;
  timeout?: boolean;
  partialOutputs?: unknown[];
}): ToolResult<T> {
  if (input.permissionDenied) return { ok: false, status: 'FAILED', errorCode: 'PERMISSION_DENIED', message: 'Izin tidak mencukupi.', retryable: false, safeNextAction: 'Minta izin terarah untuk tool/path/action yang diperlukan.' };
  if (input.timeout) return { ok: false, status: 'FAILED', errorCode: 'TIMEOUT', message: 'Tool melewati batas waktu.', retryable: true, safeNextAction: 'Ulangi satu kali dengan scope lebih kecil.' };
  if (input.error) return { ok: false, status: 'FAILED', errorCode: 'RUNTIME_ERROR', message: input.error instanceof Error ? input.error.message : String(input.error), retryable: true, safeNextAction: 'Periksa dependency dan input sebelum retry.' };
  if (input.partialOutputs?.length) return { ok: false, status: 'PARTIAL', data: input.data, errorCode: 'PARTIAL_SUCCESS', message: 'Sebagian hasil berhasil.', retryable: true, partialOutputs: input.partialOutputs, expectedState: input.expectedState, actualState: input.actualState, safeNextAction: 'Verifikasi output parsial lalu lanjutkan bagian yang belum selesai.' };
  if (input.expectedState !== undefined && stable(input.expectedState) !== stable(input.actualState)) {
    return { ok: false, status: 'FAILED', data: input.data, errorCode: 'NO_EFFECT', message: 'Tool selesai tetapi expected state tidak tercapai.', retryable: false, expectedState: input.expectedState, actualState: input.actualState, safeNextAction: 'Hentikan klaim sukses, inspeksi state, lalu rollback atau handoff.' };
  }
  return { ok: true, status: 'SUCCESS', data: input.data, message: 'Tool berhasil dan state terverifikasi.', retryable: false, expectedState: input.expectedState, actualState: input.actualState };
}
