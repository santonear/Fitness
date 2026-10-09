import {readFile,writeFile as writeBytes,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {SOURCE,adaptDataset,validateReplacements} from './repdb.mjs';
import {chineseName} from './names-zh.mjs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export async function writeIfChanged(path, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  try { if ((await readFile(path)).equals(bytes)) return false; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeBytes(path, bytes); return true;
}

// Only the hash-pinned official archive is accepted. Never extract arbitrary paths.
export function readZip(buffer){
  let end=buffer.length-22;while(end>=Math.max(0,buffer.length-65557)&&buffer.readUInt32LE(end)!==0x06054b50)end--;
  if(end<0)throw Error('Invalid ZIP');const count=buffer.readUInt16LE(end+10);let offset=buffer.readUInt32LE(end+16);const files=new Map();
  for(let i=0;i<count;i++){
    if(buffer.readUInt32LE(offset)!==0x02014b50)throw Error('Invalid directory');
    const method=buffer.readUInt16LE(offset+10),size=buffer.readUInt32LE(offset+20),length=buffer.readUInt16LE(offset+28),extra=buffer.readUInt16LE(offset+30),comment=buffer.readUInt16LE(offset+32),local=buffer.readUInt32LE(offset+42),name=buffer.subarray(offset+46,offset+46+length).toString();
    if(name.includes('..')||name.startsWith('/')||name.includes('\\')||files.has(name))throw Error('Unsafe ZIP entry');
    files.set(name,()=>{if(buffer.readUInt32LE(local)!==0x04034b50)throw Error('Invalid local entry');const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28),bytes=buffer.subarray(start,start+size);if(method===0)return bytes;if(method===8)return inflateRawSync(bytes);throw Error('Unsupported ZIP compression');});offset+=46+length+extra+comment;
  }return files;
}
export async function build(){
  await mkdir('.cache/repdb',{recursive:true});const cache='.cache/repdb/free.zip';let bytes;
  try{bytes=await readFile(cache);}catch{const response=await fetch(SOURCE.url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Official archive unavailable');bytes=Buffer.from(await response.arrayBuffer());}
  if(createHash('sha256').update(bytes).digest('hex')!==SOURCE.sha256)throw Error('RepDB archive changed: review source and license before updating the pin');
  await writeIfChanged(cache,bytes);const files=readZip(bytes);const raw=JSON.parse(files.get('free.json')().toString());const catalog=adaptDataset(raw,new Set(files.keys()),chineseName);validateReplacements(catalog.entries);
  if(catalog.entries.length!==637)throw Error('Unexpected source count');
  await mkdir('src/catalog/generated',{recursive:true});await mkdir('public/exercise-media/repdb',{recursive:true});
  const allowedFiles=new Set(['notices','notices/LICENSE.md','notices/ATTRIBUTION.md',...catalog.entries.flatMap(row=>Object.values(row.media).map(path=>path.slice('/exercise-media/repdb/'.length)))]);
  for(const path of await readdir('public/exercise-media/repdb',{recursive:true}))if(!allowedFiles.has(path.replaceAll('\\','/')))throw Error('Unexpected public RepDB resource: '+path);
  const registry=catalog.entries.map(({id,slug,metricType,aliases,bodyPart,primaryMuscles,secondaryMuscles,media})=>({id,slug,metricType,aliases,bodyPart,primaryMuscles,secondaryMuscles,media}));
  // Runtime core is small; detailed provider instructions remain a lazy app chunk.
  const core=catalog.entries.map(({id,name,equipment,category,metricType,allowedMetrics})=>({id,catalogVersion:1,name,equipment,category,metricType,allowedMetrics,steps:{zh:['详细说明为英文；请查看动作详情。'],en:['See exercise details for the original English instructions.']},cautions:{zh:[],en:[]}}));
  await writeIfChanged('src/catalog/generated/registry.json',JSON.stringify(registry));await writeIfChanged('src/catalog/generated/core.json',JSON.stringify(core));await writeIfChanged('src/catalog/generated/details.json',JSON.stringify(catalog));
  let copied=0;for(const row of catalog.entries)for(const pose of Object.keys(row.media)){const name=`images/flat/${row.source.externalId}-${pose}.webp`;const image=files.get(name)();if(image.toString('ascii',0,4)!=='RIFF'||image.toString('ascii',8,12)!=='WEBP')throw Error('Invalid WebP');await writeIfChanged('public'+row.media[pose],image);copied++;}
  await mkdir('public/exercise-media/repdb/notices',{recursive:true});
  for(const name of ['LICENSE.md','ATTRIBUTION.md'])await writeIfChanged('public/exercise-media/repdb/notices/'+name,files.get(name)());
  await writeIfChanged('src/catalog/generated/source.json',JSON.stringify({catalogVersion:catalog.catalogVersion,...SOURCE,exercises:catalog.entries.length,images:copied}));
  console.log(`RepDB verified: ${catalog.entries.length} exercises, ${copied} images; SHA256 ${SOURCE.sha256}; no premium assets.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
