import { aggregateRedFlags } from './health/red-flags-v2';
import { enforceDoseBoundary } from './health/dose-boundary';
import { detectOverdose } from './health/overdose-gate';

export type HealthGate = 'emergency' | 'self_harm' | 'pregnancy' | 'child' | 'elderly' | 'renal_hepatic' | 'interaction' | 'dose_boundary' | 'routine' | 'not_health';
export type HealthAnalysis = {
  active: boolean;
  gate: HealthGate;
  severity: 'critical' | 'high' | 'medium' | 'low';
  triggers: string[];
  emergency: boolean;
  handoff: string | null;
  diagnosisAllowed: false;
  imageBoundary: boolean;
  privacySensitive: boolean;
  matches: Array<{ gate: string; term: string; severity: string }>;
  doseBlocked: boolean;
};

const HEALTH_TERMS = ['obat', 'gejala', 'penyakit', 'terapi', 'dokter', 'klinik', 'rumah sakit', 'herbal', 'jamu', 'vitamin', 'suplemen', 'demam', 'nyeri', 'batuk', 'darah', 'kesehatan', 'hamil', 'warfarin'];

export function analyzeHealthRequest(text: string): HealthAnalysis {
  const low = text.toLowerCase();
  const red = aggregateRedFlags(text);
  const overdose = detectOverdose(text);
  const dose = enforceDoseBoundary(text);
  const active = HEALTH_TERMS.some((term) => low.includes(term)) || red.matches.length > 0 || overdose.active || dose.asksDose;
  if (!active) return { active: false, gate: 'not_health', severity: 'low', triggers: [], emergency: false, handoff: null, diagnosisAllowed: false, imageBoundary: true, privacySensitive: false, matches: [], doseBlocked: false };
  if (overdose.active || red.emergency) {
    return { active: true, gate: 'emergency', severity: 'critical', triggers: [...red.matches.map((item) => item.term), ...(overdose.active ? ['overdose'] : [])], emergency: true, handoff: overdose.instruction || red.primary?.message || 'Segera cari bantuan medis darurat.', diagnosisAllowed: false, imageBoundary: true, privacySensitive: true, matches: red.matches, doseBlocked: dose.blocked };
  }
  if (dose.blocked) return { active: true, gate: 'dose_boundary', severity: 'high', triggers: ['prescription-dose'], emergency: false, handoff: dose.message, diagnosisAllowed: false, imageBoundary: true, privacySensitive: true, matches: red.matches, doseBlocked: true };
  const gate: HealthGate = low.includes('hamil') ? 'pregnancy' : low.includes('bayi') || low.includes('balita') ? 'child' : low.includes('lansia') ? 'elderly' : low.includes('ginjal') || low.includes('hati') ? 'renal_hepatic' : low.includes('interaksi') || low.includes('warfarin') ? 'interaction' : 'routine';
  return { active: true, gate, severity: gate === 'routine' ? 'low' : 'high', triggers: red.matches.map((item) => item.term), emergency: false, handoff: gate === 'routine' ? null : 'Konsultasikan dengan dokter, bidan, atau apoteker sesuai konteks.', diagnosisAllowed: false, imageBoundary: true, privacySensitive: true, matches: red.matches, doseBlocked: false };
}

export function buildHealthContext(analysis: HealthAnalysis): string {
  if (!analysis.active) return '';
  return [
    'R13.45 health safety context:',
    `gate=${analysis.gate}`,
    `severity=${analysis.severity}`,
    `red_flags=${analysis.matches.map((item) => item.term).join(',') || 'none'}`,
    'Do not diagnose, prescribe, set prescription doses, or promise outcomes.',
    'State evidence level, uncertainty, contraindications, interactions, and professional-care boundary.',
    analysis.handoff ? `handoff=${analysis.handoff}` : '',
  ].filter(Boolean).join('\n');
}

export function buildEmergencyHealthAnswer(analysis: HealthAnalysis): string | null {
  if (!analysis.emergency) return null;
  return `Ini berpotensi menjadi keadaan darurat. ${analysis.handoff || 'Segera cari bantuan medis darurat.'}\n\nJangan menunggu jawaban AI. Jika aman, siapkan nama zat/obat, jumlah, waktu kejadian, gejala, alergi, dan riwayat penyakit untuk petugas medis.`;
}
