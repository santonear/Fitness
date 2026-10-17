import {Worker} from 'node:worker_threads';
import type {EngineProfile} from '../../src/engine/contracts';
import type {ProfileObservation} from './training-engine-audit';
export async function parallelProfiles(jobs:{profile:EngineProfile;quality:boolean}[],count:number,workerUrl?:string):Promise<ProfileObservation[]>{
 if(!workerUrl)throw Error('Parallel audit requires a bundled worker URL');
 if(!Number.isInteger(count)||count<1)throw Error('Worker count must be a positive integer');
 if(!jobs.length)return [];
 const workers:Worker[]=[],results:ProfileObservation[]=new Array(jobs.length);let next=0,completed=0;
 try{return await new Promise((resolve,reject)=>{
  const dispatch=(worker:Worker)=>{const index=next++;if(index<jobs.length)worker.postMessage({index,...jobs[index]});};
  for(let n=0;n<Math.min(count,jobs.length);n++){
   const worker=new Worker(new URL(workerUrl));workers.push(worker);
   worker.on('error',reject);worker.on('exit',code=>{if(completed<jobs.length)reject(Error(`Audit worker exited early (${code})`));});
   worker.on('message',({index,observation}:{index:number;observation:ProfileObservation})=>{results[index]=observation;completed++;if(completed===jobs.length)resolve(results);else dispatch(worker);});
   dispatch(worker);
  }
 });}finally{await Promise.all(workers.map(worker=>worker.terminate()));}
}
