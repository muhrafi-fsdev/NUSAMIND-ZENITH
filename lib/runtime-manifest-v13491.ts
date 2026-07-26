import manifest from '@/data/release/r13.49.1/manifest.json';
import {RELEASE} from './release';
import {cyberCapabilities,evaluateCyberPolicy} from '@/packages/cybersecurity';
export function runtimeManifestV13491(){
  const edition=String(RELEASE.edition) as 'swift'|'zenith'|'apex';
  return{release:RELEASE.label,version:RELEASE.version,edition,status:'CYBERSECURITY_POLICY_VALIDATED',uiChanged:false,desktopApplicationUpdate:'CANCELLED',manifest,cybersecurity:{capabilities:cyberCapabilities(edition),evaluation:evaluateCyberPolicy(edition)}};
}
