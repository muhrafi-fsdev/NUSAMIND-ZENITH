import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
export async function fileHash(file:string){try{return hash(await fs.readFile(file));}catch{return null;}}
export async function atomicWriteFile(target:string,content:string,opts:{append?:boolean;expectedHash?:string}={}){
  await fs.mkdir(path.dirname(target),{recursive:true});const current=await fileHash(target);if(opts.expectedHash&&current!==opts.expectedHash)throw new Error('File berubah sejak preview. Muat ulang sebelum menulis.');
  const previous=opts.append?await fs.readFile(target,'utf8').catch(()=> ''):'';const final=previous+content;const temp=path.join(path.dirname(target),`.${path.basename(target)}.${randomUUID()}.tmp`);const backup=current?`${target}.nusamind.bak`:null;
  if(backup)await fs.copyFile(target,backup);await fs.writeFile(temp,final,{encoding:'utf8',flag:'wx'});await fs.rename(temp,target);return{target,backup,previousHash:current,hash:hash(final),bytes:Buffer.byteLength(final)};
}
export async function atomicMoveFile(source:string,target:string,expectedHash?:string){const current=await fileHash(source);if(!current)throw new Error('File sumber tidak ditemukan.');if(expectedHash&&current!==expectedHash)throw new Error('File sumber berubah sejak preview.');await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target);const copied=await fileHash(target);if(copied!==current){await fs.rm(target,{force:true});throw new Error('Verifikasi checksum setelah copy gagal.');}await fs.rm(source);return{source,target,hash:current};}
