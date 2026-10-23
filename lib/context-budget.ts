export type KvType = 'f16' | 'q8_0' | 'q4_0';
export type Thinking = 'off' | 'auto' | 'on';

export type ArchSpec = {
  layers: number;
  kvHeads: number;
  headDim: number;
  maxPositions: number;
  weightsMB: number;
  weightsVerified: boolean;
  hf?: string;
};

export type Budgets = {
  systemTokens: number;
  sourcesTokens: number;
  memoryItems: number;
  sessionBlockChars: number;
  digestTokens: number;
  recallTokens: number;
  minHistoryTokens: number;
  perMessageMaxChars: number;
  olderMessageMaxChars: number;
  blockSize: number;
  minVerbatimMessages: number;
};

export type HardwareProfile = {
  label: string;
  ramGB: number;
  models: { main: string; coder: string; fallback: string };
  thinking: Thinking;
  contextTokens: number;
  coderContextTokens: number;
  reserveOutputTokens: number;
  maxOutputTokens: number;
  enforceOutputCap: boolean;
  maxSteps: number;
  toolsEnabled: boolean;
  compactPrompt: boolean;
  kvCacheType: KvType;
  ollamaServerEnv: Record<string, string>;
  budgets: Budgets;
  tokenSafetyFactor: number;
};

export type HardwareProfilesFile = {
  format: string;
  release: string;
  default: string;
  runtimeOverheadMB: number;
  kvTypes: Record<string, { factor: number }>;
  architectures: Record<string, ArchSpec>;
  profiles: Record<string, HardwareProfile>;
};

const BYTES_F16 = 2;

/** Byte KV cache per token = 2 (K dan V) x layer x KV head x head_dim x byte per elemen x faktor kuantisasi. */
export function kvBytesPerToken(arch: ArchSpec, kv: KvType, file: Pick<HardwareProfilesFile, 'kvTypes'>): number {
  const factor = file.kvTypes[kv]?.factor;
  if (!(factor > 0)) throw new Error(`Tipe KV tidak dikenal: ${kv}`);
  return 2 * arch.layers * arch.kvHeads * arch.headDim * BYTES_F16 * factor;
}

export type MemoryEstimate = { weightsMB: number; kvMB: number; overheadMB: number; totalMB: number; kvBytesPerToken: number };

export function estimateMemory(file: HardwareProfilesFile, modelTag: string, contextTokens: number, kv: KvType): MemoryEstimate {
  const arch = file.architectures[modelTag];
  if (!arch) throw new Error(`Arsitektur model belum terdaftar: ${modelTag}`);
  const perToken = kvBytesPerToken(arch, kv, file);
  const kvMB = (perToken * contextTokens) / 1e6;
  const total = arch.weightsMB + kvMB + file.runtimeOverheadMB;
  return { weightsMB: arch.weightsMB, kvMB, overheadMB: file.runtimeOverheadMB, totalMB: total, kvBytesPerToken: perToken };
}

/** Konteks terbesar (kelipatan 256, tidak melebihi batas posisi model) yang muat di anggaran memori. 0 bila bobot saja tidak muat. */
export function maxContextForMemory(file: HardwareProfilesFile, modelTag: string, kv: KvType, budgetMB: number): number {
  const arch = file.architectures[modelTag];
  if (!arch) throw new Error(`Arsitektur model belum terdaftar: ${modelTag}`);
  const room = budgetMB - arch.weightsMB - file.runtimeOverheadMB;
  if (room <= 0) return 0;
  const tokens = Math.floor((room * 1e6) / kvBytesPerToken(arch, kv, file));
  return Math.min(arch.maxPositions, Math.floor(tokens / 256) * 256);
}

/** Memori KV (GiB) yang dibutuhkan agar `tokens` token aktif sekaligus berada dalam konteks. */
export function kvGiBForTokens(file: HardwareProfilesFile, modelTag: string, kv: KvType, tokens: number): number {
  const arch = file.architectures[modelTag];
  if (!arch) throw new Error(`Arsitektur model belum terdaftar: ${modelTag}`);
  return (kvBytesPerToken(arch, kv, file) * tokens) / 1024 ** 3;
}

/** Bagian RAM yang dianggap tersedia untuk satu model Ollama (sisanya untuk OS, Next.js, dan layanan lain). Asumsi perencanaan. */
export const RAM_SHARE_FOR_MODEL = 0.6;

export function validateProfilesFile(file: HardwareProfilesFile): string[] {
  const problems: string[] = [];
  if (!file.profiles[file.default]) problems.push(`profil bawaan "${file.default}" tidak ada`);
  for (const [name, p] of Object.entries(file.profiles)) {
    const at = `profil ${name}`;
    for (const role of ['main', 'coder', 'fallback'] as const) {
      const tag = p.models[role];
      const arch = file.architectures[tag];
      if (!arch) { problems.push(`${at}: model ${role} "${tag}" tidak punya entri arsitektur`); continue; }
      if (role !== 'fallback') {
        const ctx = role === 'main' ? p.contextTokens : p.coderContextTokens;
        if (ctx > arch.maxPositions) problems.push(`${at}: konteks ${ctx} melebihi batas posisi ${arch.maxPositions} milik ${tag}`);
      }
      if (!file.kvTypes[p.kvCacheType]) { problems.push(`${at}: kvCacheType "${p.kvCacheType}" tidak dikenal`); continue; }
      const ctx = role === 'coder' ? p.coderContextTokens : p.contextTokens;
      const est = estimateMemory(file, tag, ctx, p.kvCacheType);
      const limit = p.ramGB * 1000 * RAM_SHARE_FOR_MODEL;
      if (est.totalMB > limit) problems.push(`${at}: ${tag} memerlukan ±${Math.round(est.totalMB)} MB, melebihi ${Math.round(limit)} MB (${Math.round(RAM_SHARE_FOR_MODEL * 100)}% dari ${p.ramGB} GB)`);
    }
    if (p.reserveOutputTokens >= p.contextTokens) problems.push(`${at}: reserveOutputTokens >= contextTokens`);
    if (p.enforceOutputCap && p.maxOutputTokens > p.reserveOutputTokens) problems.push(`${at}: maxOutputTokens melebihi cadangan output`);
    if (p.budgets.systemTokens + p.budgets.minHistoryTokens + p.reserveOutputTokens >= p.contextTokens && p.compactPrompt) problems.push(`${at}: anggaran sistem + riwayat minimum + output melebihi konteks`);
    for (const [k, v] of Object.entries(p.budgets)) if (!(typeof v === 'number' && v > 0)) problems.push(`${at}: budgets.${k} harus positif`);
    if (!(p.tokenSafetyFactor >= 1)) problems.push(`${at}: tokenSafetyFactor harus >= 1`);
  }
  return problems;
}

export function getProfile(file: HardwareProfilesFile, requested?: string | null): { name: string; profile: HardwareProfile; warning?: string } {
  const wanted = String(requested || '').trim().toLowerCase();
  if (wanted && file.profiles[wanted]) return { name: wanted, profile: file.profiles[wanted] };
  const name = file.default;
  return {
    name,
    profile: file.profiles[name],
    ...(wanted ? { warning: `Profil "${wanted}" tidak dikenal; memakai "${name}". Pilihan: ${Object.keys(file.profiles).join(', ')}.` } : {}),
  };
}
