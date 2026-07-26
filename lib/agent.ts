export type ToolPlan={intent:string;tool:string;args:Record<string,string>;risk:'low'|'medium'|'high';requiresConfirmation:boolean;verify:string[]};
export function planNaturalAction(input:string):ToolPlan|null{
  const text=input.trim();let m:RegExpMatchArray|null;
  if((m=text.match(/^(?:buka|jalankan) aplikasi\s+(.+)$/i)))return {intent:'open-app',tool:'app-open',args:{app:m[1].trim()},risk:'medium',requiresConfirmation:true,verify:['process-started']};
  if((m=text.match(/^tutup aplikasi\s+(.+)$/i)))return {intent:'close-app',tool:'app-close',args:{app:m[1].trim()},risk:'medium',requiresConfirmation:true,verify:['process-stopped']};
  if((m=text.match(/^buat file\s+"([^"]+)"\s+(?:isi\s+)?([\s\S]+)$/i)))return {intent:'create-file',tool:'file-create',args:{path:m[1],content:m[2]},risk:'medium',requiresConfirmation:true,verify:['file-exists','checksum']};
  if((m=text.match(/^pindahkan file\s+"([^"]+)"\s+ke\s+"([^"]+)"$/i)))return {intent:'move-file',tool:'file-move',args:{source:m[1],target:m[2]},risk:'high',requiresConfirmation:true,verify:['source-missing','target-exists','checksum']};
  return null;
}
