export type RedFlagMatch={gate:string;severity:'critical'|'high';term:string;message:string};
const GROUPS=[
 {gate:'cardiac',severity:'critical' as const,terms:['nyeri dada','dada tertekan','keringat dingin'],message:'Segera cari bantuan medis darurat.'},
 {gate:'breathing',severity:'critical' as const,terms:['sesak berat','sulit bernapas','bibir membiru'],message:'Hubungi layanan darurat sekarang.'},
 {gate:'stroke',severity:'critical' as const,terms:['wajah mencong','bicara pelo','lemah satu sisi'],message:'Curiga stroke; waktu penanganan sangat penting.'},
 {gate:'bleeding',severity:'critical' as const,terms:['perdarahan hebat','muntah darah','bab hitam'],message:'Segera ke fasilitas kesehatan.'},
 {gate:'pregnancy',severity:'high' as const,terms:['hamil perdarahan','kehamilan perdarahan','gerak janin berkurang'],message:'Segera hubungi dokter/bidan atau IGD.'},
 {gate:'neurologic',severity:'critical' as const,terms:['kejang','tidak sadar','pingsan lama'],message:'Jaga keamanan pasien dan cari bantuan darurat.'},
 {gate:'poisoning',severity:'critical' as const,terms:['overdosis','keracunan','minum obat terlalu banyak'],message:'Hubungi layanan darurat/pusat informasi keracunan; jangan memicu muntah tanpa arahan.'}
];
export function aggregateRedFlags(text:string){const low=text.toLowerCase();const matches:RedFlagMatch[]=[];for(const group of GROUPS)for(const term of group.terms)if(low.includes(term))matches.push({gate:group.gate,severity:group.severity,term,message:group.message});return{matches,emergency:matches.some(x=>x.severity==='critical'),primary:matches.sort((a,b)=>a.severity==='critical'&&b.severity!=='critical'?-1:1)[0]||null};}
