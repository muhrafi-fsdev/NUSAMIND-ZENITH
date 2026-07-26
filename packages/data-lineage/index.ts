export type LineageStep={operation:string;inputHash:string;outputHash:string;timestamp:string};
export function appendLineage(steps:LineageStep[],step:LineageStep){return [...steps,step];}
