export type CorrectionResult = {
  answer: string;
  passes: number;
  changes: string[];
  stopped: 'stable' | 'pass-limit';
};

export function correctAnswer(answer: string, maxPasses = 1): CorrectionResult {
  let current = String(answer || '').trim();
  const changes: string[] = [];
  let passes = 0;
  for (; passes < Math.max(0, maxPasses); passes += 1) {
    const before = current;
    current = current
      .replace(/^\s*(?:Akurasi|Confidence)\s*:\s*\d{1,3}%\s*$/gim, '')
      .replace(/\b(?:pasti|dijamin)\s+100%\b/gi, 'belum dapat dijamin')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (current === before) return { answer: current, passes, changes, stopped: 'stable' };
    changes.push('format-and-overclaim-cleanup');
  }
  return { answer: current, passes, changes, stopped: 'pass-limit' };
}
