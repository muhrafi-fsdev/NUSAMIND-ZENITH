export function reasoningPrivacy(){return{rawChainOfThoughtStored:false,decisionSummariesOnly:true};}
export function externalInstructionAuthority(text:string){const injection=/ignore (?:system|previous)|reveal secret|bypass/i.test(text);return{instructionAuthority:'none',quarantined:injection,trust:'unverified'};}
