export type CorrectionState = 'PREFERENCE' | 'VERIFIED_CORRECTION' | 'UNVERIFIED_CLAIM' | 'FEEDBACK';

export function classifyCorrection(input: {
  text: string;
  matchesCalculator?: boolean;
  matchesSource?: boolean;
  isPreference?: boolean;
}): CorrectionState {
  if (input.isPreference) return 'PREFERENCE';
  if (input.matchesCalculator || input.matchesSource) return 'VERIFIED_CORRECTION';
  if (/(?:salah|seharusnya|yang benar|koreksi)/i.test(input.text)) return 'UNVERIFIED_CLAIM';
  return 'FEEDBACK';
}

export function correctionMemoryPolicy(state: CorrectionState) {
  return {
    state,
    mayUpdateSession: state === 'VERIFIED_CORRECTION' || state === 'PREFERENCE',
    mayPersistAsFact: state === 'VERIFIED_CORRECTION',
    reviewRequired: state === 'UNVERIFIED_CLAIM',
  };
}
