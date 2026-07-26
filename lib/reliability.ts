import { RELEASE } from './release';

export const reliabilityProfile = {
  release: RELEASE.label,
  edition: RELEASE.edition,
  mode: "verified-expert",
  benchmarkRequired: true,
  rules: [
  "Adaptive Reasoning Router V3 memilih fast, grounded, analytical, atau supervised-agent path.",
  "Evidence-first pipeline: evidence/calculation/tool outcome dikumpulkan sebelum claim final.",
  "Claim-level verifier menandai VERIFIED, SUPPORTED, INFERRED, ESTIMATED, DISPUTED, MISSING_EVIDENCE, atau UNSUPPORTED.",
  "Source intelligence memakai authority, content/effective date, jurisdiction, deprecation, dan lineage.",
  "Capability status harus berasal dari handler, dependency, DB, permission, feature flag, dan benchmark nyata.",
  "Tool success wajib diverifikasi terhadap expected state; NO_EFFECT bukan sukses.",
  "Koreksi user disimpan sebagai verified correction hanya setelah source/calculator cocok.",
  "Reliability status memakai label jujur, bukan persentase dekoratif.",
  "Trace menyimpan outcome terstruktur tanpa private chain-of-thought.",
  "Web UI Stitch tidak boleh diubah."
],
  editionRules: [
  "Multi-hop evidence graph dan dual-layer claim verification.",
  "Multi-pass expert review dengan stop condition dan budget.",
  "Source conflict resolution transparan tanpa memaksa kesimpulan.",
  "Failure-aware supervised agent: continue, retry, rollback, stop, atau handoff.",
  "Claim/section scorecard serta automatic expert regression fixture."
],
} as const;

export function buildReliabilityPrompt(): string {
  return `Reliability Architecture ${reliabilityProfile.release} (${reliabilityProfile.mode}):
${reliabilityProfile.rules.map((rule) => `- ${rule}`).join('\n')}

Edition reliability rules:
${reliabilityProfile.editionRules.map((rule) => `- ${rule}`).join('\n')}

Aturan wajib:
- Jangan klaim fitur tersedia hanya karena ada di manifest; cek runtime capability.
- Jangan pilih satu sumber saat data konflik tanpa membandingkan authority, scope, content/effective date, dan independence.
- Klaim angka kritis wajib berasal dari calculator/tool yang hasilnya terverifikasi.
- Jangan menyimpan koreksi user sebagai fakta sebelum verifikasi.
- Saat evidence tidak cukup, beri bagian aman yang dapat dijelaskan, minta data minimum, atau handoff.
- Jangan menyimpan private chain-of-thought.
- Jangan mengubah source UI web.`; 
}
