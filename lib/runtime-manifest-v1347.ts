import { RELEASE } from './release';
import manifest from '@/data/release/r13.47/manifest.json';
import phases from '@/data/release/r13.47/phases.json';
import { capabilityLifecycleV4 } from './capability-checker-v4';
import { tokenProfile } from './prompt-engine/token-context';
import { advancedTechniqueStatus } from './prompt-engine/advanced';
import { agentStatus } from './agent-v3';
export function runtimeManifestV1347(){return{release:RELEASE.label,version:RELEASE.version,edition:RELEASE.edition,status:'BENCHMARKED',uiChanged:false,manifest,phases,capabilities:capabilityLifecycleV4(),tokenProfile:tokenProfile(RELEASE.edition),advancedStrategies:advancedTechniqueStatus(RELEASE.edition),agent:agentStatus(),limitations:{liveQwenProfile:'CONFIGURED/BENCHMARKED offline until Ollama live profiler runs.',multimodal:'PROTOTYPE until a verified vision model is connected.',rawChainOfThoughtStored:false,externalEvidenceAuthority:'none'}};}
