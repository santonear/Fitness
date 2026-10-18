import {expect,it} from 'vitest';
import {buildRegistry,liveVersionId,previousRegistration,pullRequestNumber} from '../../tools/release/registry.mjs';
import {registeredReleases} from '../../src/backend/admin/releases/deployment';
import {rollbackBlock} from '../../src/ui/admin/releases/rollback';
import {RELEASE_DATA_VERSION} from '../../src/domain/release-data-version';

const origin='https://fitness.initdevl.workers.dev',sha='e3957c5aa1b2c3d4e5f60718293a4b5c6d7e8f90';
const live='4884ef3c-1470-4855-8634-1af7ed197764',running='7a1d2c3b-0000-4000-8000-00000000abcd';
const deployment={id:'d1',created_on:'2026-10-18T10:00:00Z',versions:[{version_id:live,percentage:100}]};
const registeredVersion={id:live,metadata:{created_on:'2026-10-18T09:59:00Z'},annotations:{'workers/message':`release=pr62-a43f4e3 data=${RELEASE_DATA_VERSION} sha=a43f4e3 pr=62`,'workers/tag':'pr62-a43f4e3'}};

it('derives the PR from the squash-merge subject and names the release after it',()=>{
 expect(pullRequestNumber('fix: 恢复生产健康检查与后台邀请码生成 (#63)')).toBe(63);
 expect(pullRequestNumber('Merge pull request #12 from x/y')).toBe(12);
 expect(pullRequestNumber('docs: no pr')).toBeUndefined();
 expect(liveVersionId(deployment)).toBe(live);
});
it('registers commit, PR, time and the real previous version, and the worker accepts it',()=>{
 const now=new Date('2026-10-19T08:00:00Z');
 const result=buildRegistry({environment:'production',sha,subject:'fix: x (#63)',smokeOrigin:origin,deployment,version:registeredVersion,now});
 const entry=result.registry[0];
 expect(entry.current).toMatchObject({id:'pr63-e3957c5',commit:sha,pr:63,publishedAt:now.toISOString(),compatibleDataVersion:RELEASE_DATA_VERSION});
 expect(entry.previous).toMatchObject({id:'pr62-a43f4e3',deploymentId:live,publishedAt:'2026-10-18T09:59:00.000Z',compatibleDataVersion:RELEASE_DATA_VERSION,commit:'a43f4e3',pr:62});
 expect(result.message).toBe(`release=pr63-e3957c5 data=${RELEASE_DATA_VERSION} sha=e3957c5 pr=63`);
 const [parsed]=registeredReleases({ADMIN_ENVIRONMENT:'production',ADMIN_RELEASE_REGISTRY:JSON.stringify(result.registry),CF_VERSION_METADATA:{id:running,timestamp:'2026-10-19T08:01:00Z'}});
 expect(parsed.current.deploymentId).toBe(running);expect(parsed.current.publishedAt).toBe('2026-10-19T08:01:00Z');
 // A real, compatible previous version only lacks the deployment connection.
 expect(rollbackBlock(parsed,undefined,false)).toBe('adapter');expect(rollbackBlock(parsed,undefined,true)).toBeUndefined();
});
it('an older deploy without a registered data version is shown but can never be rolled back to',()=>{
 const legacy={...registeredVersion,annotations:{'workers/message':'release a43f4e3 run 18000000000'}};
 const previous=previousRegistration(deployment,legacy,origin);
 expect(previous).toMatchObject({id:'sha-a43f4e3',commit:'a43f4e3',deploymentId:live});expect(previous?.compatibleDataVersion).toBeUndefined();
 const result=buildRegistry({environment:'production',sha,subject:'x (#63)',smokeOrigin:origin,deployment,version:legacy});
 const [parsed]=registeredReleases({ADMIN_ENVIRONMENT:'production',ADMIN_RELEASE_REGISTRY:JSON.stringify(result.registry)});
 expect(rollbackBlock(parsed,undefined,true)).toBe('data_unknown');
});
it('no readable live version means no previous entry and a clear block reason',()=>{
 const result=buildRegistry({environment:'production',sha,subject:'x',smokeOrigin:origin,deployment:{},version:{}});
 expect(result.registry[0].previous).toBeUndefined();expect(result.registry[0].current.id).toBe('sha-e3957c5');
 expect(rollbackBlock(registeredReleases({ADMIN_RELEASE_REGISTRY:JSON.stringify(result.registry)})[0],undefined,true)).toBe('no_previous');
 expect(()=>buildRegistry({environment:'production',sha:'not-a-sha',subject:'',smokeOrigin:origin})).toThrow();
});
it('rollback is blocked when the registered previous is the same deployment or the state moved',()=>{
 const base={environment:'production' as const,dataVersion:RELEASE_DATA_VERSION,current:{id:'a',deploymentId:live,publishedAt:'2026-10-19T00:00:00Z',compatibleDataVersion:RELEASE_DATA_VERSION},previous:{id:'b',deploymentId:live,publishedAt:'2026-10-18T00:00:00Z',compatibleDataVersion:RELEASE_DATA_VERSION}};
 expect(rollbackBlock(base,undefined,true)).toBe('same_deployment');
 const distinct={...base,previous:{...base.previous,deploymentId:running}};
 expect(rollbackBlock(distinct,{environment:'production',current_id:'other',previous_id:'a',changed_at:'2026-10-19T00:00:00Z',operation_id:null},true)).toBe('state_changed');
 expect(rollbackBlock(distinct,{environment:'production',current_id:'a',previous_id:'b',changed_at:'2026-10-19T00:00:00Z',operation_id:'op'},true)).toBe('busy');
 expect(rollbackBlock({...distinct,previous:{...distinct.previous,compatibleDataVersion:RELEASE_DATA_VERSION-1}},undefined,true)).toBe('data_incompatible');
});
it('a manual deploy without a registry shows the live version id and offers no rollback',()=>{
 const [entry]=registeredReleases({ADMIN_ENVIRONMENT:'production',ADMIN_RELEASE_REGISTRY:'[]',CF_VERSION_METADATA:{id:running,timestamp:'2026-10-19T08:01:00Z'},CONTROL_ORIGINS:JSON.stringify([origin])} as never);
 expect(entry.current).toMatchObject({id:'cf-7a1d2c3b',deploymentId:running,smokeOrigin:origin});expect(entry.previous).toBeUndefined();
});
