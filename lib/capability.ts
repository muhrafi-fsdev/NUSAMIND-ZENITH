export type CapabilityStatus =
  | 'AVAILABLE'
  | 'DEGRADED'
  | 'DISABLED'
  | 'NOT_IMPLEMENTED'
  | 'REQUIRES_PERMISSION'
  | 'UNAVAILABLE';

export type CapabilityProbe = {
  name: string;
  implemented: boolean;
  enabled: boolean;
  handlerHealthy: boolean;
  dependencyHealthy: boolean;
  databaseHealthy?: boolean;
  benchmarkPassed?: boolean;
  permissionRequired?: boolean;
  permissionGranted?: boolean;
};

export type CapabilityResult = {
  name: string;
  status: CapabilityStatus;
  reason: string;
  userMessage: string;
};

export function checkCapability(probe: CapabilityProbe): CapabilityResult {
  if (!probe.implemented) return { name: probe.name, status: 'NOT_IMPLEMENTED', reason: 'handler_missing', userMessage: 'Fitur belum diimplementasikan.' };
  if (!probe.enabled) return { name: probe.name, status: 'DISABLED', reason: 'feature_flag_off', userMessage: 'Fitur sedang dinonaktifkan.' };
  if (probe.permissionRequired && !probe.permissionGranted) return { name: probe.name, status: 'REQUIRES_PERMISSION', reason: 'permission_required', userMessage: 'Fitur membutuhkan izin untuk tindakan ini.' };
  if (!probe.handlerHealthy || !probe.dependencyHealthy || probe.databaseHealthy === false) {
    const partial = probe.handlerHealthy && (probe.dependencyHealthy || probe.databaseHealthy !== false);
    return partial
      ? { name: probe.name, status: 'DEGRADED', reason: 'partial_runtime_failure', userMessage: 'Fitur tersedia terbatas; sebagian kemampuan belum aktif.' }
      : { name: probe.name, status: 'UNAVAILABLE', reason: 'runtime_dependency_unavailable', userMessage: 'Fitur tidak tersedia saat ini karena dependency/runtime gagal.' };
  }
  if (probe.benchmarkPassed === false) return { name: probe.name, status: 'DEGRADED', reason: 'benchmark_failed', userMessage: 'Fitur tersedia terbatas karena benchmark reliability belum lulus.' };
  return { name: probe.name, status: 'AVAILABLE', reason: 'healthy', userMessage: 'Fitur tersedia.' };
}
