import {createHash} from 'node:crypto';

export const SOURCE = {url:'https://cdn.repdb.co/repdb-assets/site/repdb-free.zip', sha256:'8f0ffe22025df4d9e915a5cbd5577479f240559c7e2c62203d7298be82df20c6', version:'repdb-free-schema3-2026-10-09', license:'RepDB Free Tier License v1.0', attribution:'Exercise data by RepDB', homepage:'https://repdb.co/'};
export const LEGACY = {walking:'d16325d9-fc00-4c41-88a1-000000000002',plank:'d16325d9-fc00-4c41-88a1-000000000004'};
export const equipment = ['none','dumbbell','ab-wheel','air-bike','pull-up-bar','dip-machine','assisted-pullup-machine','stability-ball','resistance-band','loop-band','barbell','battle-rope','lat-pulldown-machine','flat-bench','ez-bar','plyo-box','cable','chest-press-machine','kettlebell','smith-machine','leg-press','dip-station','elliptical','hack-squat','trap-bar','hip-abduction-machine','hip-adduction-machine','treadmill','jump-rope','leg-curl','leg-extension','back-extension-machine','bicep-curl-machine','standing-calf-raise-machine','chest-fly-machine','preacher-curl-machine','ab-crunch-machine','shoulder-press-machine','tricep-extension-machine','slam-ball','glute-ham-developer','pec-deck','donkey-calf-raise-machine','hip-thrust-machine','plate-loaded-lateral-raise-machine','shrug-machine','plates','rings','climbing-rope','rower','seated-calf-raise-machine','ski-erg','sled','stair-climber','stationary-bike','suspension-trainer','wrist-roller'];
const categories = new Set(['strength','cardio','stretching','plyometrics','olympic']);
export function internalId(key) {
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key))throw Error('Invalid canonical key');
  if(LEGACY[key])return LEGACY[key];
  // Fitness namespace + frozen canonical key. Display names and supplier namespaces are never business IDs.
  const hex=createHash('sha256').update('Fitness canonical exercise v1:'+key).digest('hex').slice(0,32).split('');hex[12]='5';hex[16]='8';const s=hex.join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}
export function safeMediaPath(id,pose) {
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||!['start','peak','main'].includes(pose))throw Error('Unsafe media path');
  return `images/flat/${id}-${pose}.webp`;
}
export function metricFor(row) {
  if(row.category==='cardio')return ['walking','running','treadmill-running','incline-treadmill-walk','rowing-machine','elliptical-trainer','stationary-bike','air-bike','ski-erg'].includes(row.id)?'duration_distance':'duration';
  if(row.category==='stretching'||row.force_type==='static'||/(^|-)(hold|hang|carry|walk)(-|$)/.test(row.id)||['plank','side-plank','reverse-plank','ring-plank','trx-plank','l-sit','v-sit','planche','back-lever','front-lever','human-flag','wall-sit'].includes(row.id))return 'duration';
  return row.is_bodyweight||!row.equipment||['resistance_band','loop_band'].includes(row.equipment)?'reps':'reps_load';
}
export function adaptDataset(raw,paths,translate) {
  if(raw?.schema_version!==3||!Array.isArray(raw.exercises)||!raw.exercises.length)throw Error('Unsupported RepDB schema');
  const ids=new Set(),keys=new Set();
  const entries=raw.exercises.map(row=>{
    if(!row||typeof row.id!=='string'||keys.has(row.id)||!categories.has(row.category)||typeof row.name_en!=='string'||!row.name_en.trim()||!Array.isArray(row.instructions_en)||!row.instructions_en.length||row.instructions_en.some(s=>typeof s!=='string'||!s.trim())||!Array.isArray(row.primary_muscles)||!row.primary_muscles.length)throw Error('Invalid or duplicate exercise');
    if(typeof row.body_part!=='string'||!['core','full_body','back','chest','shoulders','upper_arms','upper_legs','lower_legs','lower_arms'].includes(row.body_part)||typeof row.is_bodyweight!=='boolean'||(row.equipment!=null&&typeof row.equipment!=='string'))throw Error('Invalid exercise taxonomy');
    for(const field of ['tips_en','synonyms'])if(row[field]!==undefined&&(!Array.isArray(row[field])||row[field].some(value=>typeof value!=='string')))throw Error('Invalid text array');
    keys.add(row.id);const id=internalId(row.id);if(ids.has(id))throw Error('Duplicate internal ID');ids.add(id);
    const eq=row.equipment?row.equipment.replaceAll('_','-'):'none';if(!equipment.includes(eq))throw Error('Unknown equipment: '+eq);
    const poses=row.images?.flat??[];
    if(!Array.isArray(poses)||new Set(poses).size!==poses.length)throw Error('Invalid image shape');
    const media={};for(const pose of poses){const path=safeMediaPath(row.id,pose);if(!paths.has(path))throw Error('Missing declared media: '+path);media[pose]='/exercise-media/repdb/'+path.slice('images/flat/'.length);}
    const metricType=LEGACY[row.id]?({'goblet-squat':'reps_load',walking:'duration_distance',squat:'reps',plank:'duration'})[row.id]:metricFor(row);
    const name=translate(row.id);if(!name||/[a-z]{3,}/i.test(name.replace(/TRX|EZ|RDL/g,'')))throw Error('Missing Chinese name: '+row.id+' => '+name);
    const chineseAliases=Object.entries({'俯卧撑':'掌上压','引体向上':'拉单杠','硬拉':'硬举','臀推':'髋推'}).filter(([term])=>name.includes(term)).map(([term,alias])=>name.replaceAll(term,alias));
    const muscles=values=>values.map(v=>{if(typeof v!=='string'||!/^\w+$/.test(v))throw Error('Invalid muscle');return v.replaceAll('_','-');});
    return {id,slug:row.id,name:{zh:name,en:row.name_en},aliases:[...new Set([row.name_en,row.name_de,row.name_es,...(row.synonyms??[]),name,...chineseAliases].filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()))],primaryMuscles:muscles(row.primary_muscles),secondaryMuscles:muscles(row.secondary_muscles??[]),bodyPart:row.body_part.replaceAll('_','-'),status:'active',equipment:eq,category:row.category==='cardio'?'cardio':row.is_bodyweight||row.category==='stretching'?'bodyweight':'strength',metricType,allowedMetrics:({reps:['reps'],reps_load:['reps','loadGrams'],duration:['durationSeconds'],duration_distance:['durationSeconds','distanceMeters']})[metricType],steps:row.instructions_en,cautions:row.tips_en??[],instructionsLocale:'en',media,source:{provider:'repdb',externalId:row.id,sourceVersion:SOURCE.version,license:SOURCE.license,attributionRequired:true,attributionText:SOURCE.attribution,sourceUrl:SOURCE.homepage,importedAt:'2026-10-09'}};
  });
  return {catalogVersion:'2026.10.1',source:SOURCE,entries};
}
export function validateReplacements(entries){const map=new Map(entries.map(x=>[x.id,x]));if(map.size!==entries.length)throw Error('Duplicate ID');for(const e of entries){const seen=new Set([e.id]);let next=e.replacementId;while(next){if(seen.has(next)||!map.has(next))throw Error('Invalid replacement');seen.add(next);next=map.get(next).replacementId;}}}
