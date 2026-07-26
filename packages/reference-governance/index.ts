import coverage from '@/data/registries/reference-coverage.json';
export function coverageSummary(){const rows=coverage as Array<Record<string,string>>;return rows.reduce<Record<string,number>>((a,r)=>{a[r.gap]=(a[r.gap]||0)+1;return a;},{});}
