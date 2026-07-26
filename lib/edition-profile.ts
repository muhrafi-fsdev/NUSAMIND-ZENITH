
import { RELEASE } from './release';import topCategories from '@/data/benchmarks/top-categories.json';import runtimeProfile from '@/data/runtime/edition-profile.json';
const BASE_PROFILE={...runtimeProfile,topCategories,release:RELEASE.version,releaseLabel:RELEASE.label,edition:RELEASE.edition,editionName:RELEASE.name} as const;
export const EDITION_PROFILE=BASE_PROFILE;export const editionProfile=EDITION_PROFILE;export type EditionProfile=typeof EDITION_PROFILE;
export function buildEditionProfilePrompt(){return `Edition ${RELEASE.name} ${RELEASE.label}. Advanced prompt strategies, token-aware context, truthful capability lifecycle, reflexive recovery, agentic RAG, multimodal evidence adapter, and executable release gates are active according to edition limits. UI unchanged.`;}
export function buildEditionCommandAnswer(){return buildEditionProfilePrompt();}
