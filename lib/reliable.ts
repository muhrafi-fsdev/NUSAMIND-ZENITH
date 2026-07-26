import { routeReasoning, type ReliabilityEdition } from './reasoning-v3.ts';
import { detectConflicts, type ConflictDatum } from './conflict.ts';
import { correctAnswer } from './correction.ts';
import { assessClaims, reliabilityStatus, scoreAnswer } from './quality.ts';

export type ReliableAnswerInput = {
  question: string;
  answer: string;
  edition: ReliabilityEdition;
  sourceCount?: number;
  calculationVerified?: boolean;
  safetyOk?: boolean;
  missingData?: boolean;
  simulation?: boolean;
  conflictData?: ConflictDatum[];
  requestedFormatMet?: boolean;
};

export function finalizeReliableAnswer(input: ReliableAnswerInput) {
  const conflicts = detectConflicts(input.conflictData || []);
  const plan = routeReasoning({ question: input.question, edition: input.edition, sourceConflict: conflicts.length > 0 });
  const corrected = correctAnswer(input.answer, plan.correctionPasses);
  const claims = assessClaims({
    answer: corrected.answer,
    sourceCount: input.sourceCount,
    calculationVerified: input.calculationVerified,
    conflictCount: conflicts.length,
  });
  const scorecard = scoreAnswer({
    question: input.question,
    answer: corrected.answer,
    claims,
    sourceCount: input.sourceCount,
    calculationVerified: input.calculationVerified,
    safetyOk: input.safetyOk,
    requestedFormatMet: input.requestedFormatMet,
  });
  const status = reliabilityStatus({
    calculationVerified: input.calculationVerified,
    sourceCount: input.sourceCount,
    conflictCount: conflicts.length,
    missingData: input.missingData,
    simulation: input.simulation,
    criticalGatePassed: scorecard.criticalGatePassed,
  });
  return {
    answer: corrected.answer,
    reliability: {
      status,
      plan,
      scorecard,
      claims,
      conflicts,
      correction: { passes: corrected.passes, changes: corrected.changes, stopped: corrected.stopped },
      trace: {
        intent: input.question.slice(0, 180),
        sourceCount: input.sourceCount || 0,
        claimStates: claims.reduce<Record<string, number>>((acc, claim) => {
          acc[claim.state] = (acc[claim.state] || 0) + 1;
          return acc;
        }, {}),
        privateChainOfThoughtStored: false,
      },
    },
  };
}
