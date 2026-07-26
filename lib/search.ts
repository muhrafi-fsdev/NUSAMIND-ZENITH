export type SearchItem={id:string;text:string;metadata?:Record<string,string>;vectorScore?:number;trust?:number};
export type SearchHit=SearchItem&{score:number;keywordScore:number};
const tokens=(s:string)=>new Set(s.toLowerCase().match(/[a-z0-9À-ɏḀ-ỿ]+/g)||[]);
export function hybridSearch(query:string,items:SearchItem[],limit=8):SearchHit[]{
  const q=tokens(query);
  return items.map(item=>{const t=tokens(item.text);let hit=0;for(const x of q)if(t.has(x))hit++;const keywordScore=q.size?hit/q.size:0;const vector=Math.max(0,Math.min(1,item.vectorScore||0));const trust=Math.max(0,Math.min(1,item.trust??0.7));return {...item,keywordScore,score:(keywordScore*0.5)+(vector*0.35)+(trust*0.15)};})
    .filter(x=>x.score>=0.12).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,limit));
}
