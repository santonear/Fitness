import {parentPort} from 'node:worker_threads';
import {observeProfile} from './training-engine-audit';
import type {EngineProfile} from '../../src/engine/contracts';
if(!parentPort)throw Error('Audit worker requires a parent port');
parentPort.on('message',({index,profile,quality}:{index:number;profile:EngineProfile;quality:boolean})=>{parentPort!.postMessage({index,observation:observeProfile(profile,quality)});});
