import {createServer} from 'vite';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {generateKeyPair,SignJWT} from 'jose';

// Test-only loopback server. No production credentials, model transport or public listener.
const port=Number(process.env.ADMIN_INTEGRATION_PORT??5397);
const origin=`http://127.0.0.1:${port}`;
const workerOrigin='https://fitness.integration.test';
const accessIssuer='https://fitness-integration.cloudflareaccess.com';
const applicationId='10000000-0000-4000-8000-000000000001';
const subjectId='20000000-0000-4000-8000-000000000002';
const admin=new DatabaseSync(':memory:');
const control=new DatabaseSync(':memory:');
const {publicKey,privateKey}=await generateKeyPair('RS256');
let worker,auth,initialState;
let dropNextUserResponse=false;
const currentDeployment='30000000-0000-4000-8000-000000000003';
const previousDeployment='40000000-0000-4000-8000-000000000004';
let syntheticDeployment=currentDeployment;
let smokeFailure=false;
let featureFailure=false;

function binding(connection){
  const prepare=(sql,values=[])=>({
    bind:(...next)=>prepare(sql,next),
    first:async()=>connection.prepare(sql).get(...values)??null,
    all:async()=>({results:connection.prepare(sql).all(...values)}),
    run:async()=>({success:true,meta:{changes:Number(connection.prepare(sql).run(...values).changes)}}),
    execute:()=>({success:true,meta:{changes:Number(connection.prepare(sql).run(...values).changes)}}),
  });
  return {prepare,withSession:()=>({prepare}),batch:async statements=>{
    // Execute synchronously inside the transaction; avoid yielding a connection mid-batch.
    connection.exec('BEGIN IMMEDIATE');try{const results=statements.map(statement=>statement.execute());connection.exec('COMMIT');return results;}catch(error){connection.exec('ROLLBACK');throw error;}
  }};
}
const env={ADMIN_DB:binding(admin),CONTROL_DB:binding(control),ADMIN_ENVIRONMENT:'preview',ADMIN_CONSOLE_ENABLED:'true',
  ADMIN_ACCESS_ISSUER:accessIssuer,ADMIN_ACCESS_AUD:'fitness-integration',ADMIN_EMAIL:'admin@integration.test',
  CONTROL_MODE:'control-only',CONTROL_ADMIN_SECRET:randomBytes(32).toString('hex'),CONTROL_DIGEST_SECRET:randomBytes(32).toString('hex'),
  CONTROL_ORIGINS:JSON.stringify([workerOrigin]),CONTROL_POLICY:JSON.stringify({timeZone:'UTC',k:1,budgetLimit:3500,maximumRequestCost:1000,requestBounds:{understand:100,generate:300,summary:300},quotas:{understand:8,generate:4,summary:4},maxInputBytes:65536,maxConcurrent:4}),
  FITNESS_FEATURE_FLAGS:'{}',ADMIN_ERROR_COLLECTION_ENABLED:'false',
  ADMIN_RELEASE_REGISTRY:JSON.stringify([{environment:'preview',dataVersion:11,current:{id:'synthetic-current',deploymentId:'30000000-0000-4000-8000-000000000003',publishedAt:new Date().toISOString(),compatibleDataVersion:11,smokeOrigin:'https://preview.invalid'},previous:{id:'synthetic-previous',deploymentId:'40000000-0000-4000-8000-000000000004',publishedAt:new Date(Date.now()-86400000).toISOString(),compatibleDataVersion:11,smokeOrigin:'https://preview.invalid'}}]),
  ASSETS:{fetch:async()=>new Response(html,{headers:{'Content-Type':'text/html','x-synthetic-release':syntheticDeployment}})},
  ADMIN_RELEASE_ADAPTER:{fetch:async request=>{
    const command=await request.json();const requestId=request.headers.get('Idempotency-Key');
    if(command.environment!=='preview'||command.targetDeployment!==previousDeployment||command.expectedDeployment!==currentDeployment||!requestId)return Response.json({error:'UNREGISTERED_TEST_DEPLOYMENT'},{status:409});
    if(![currentDeployment,previousDeployment].includes(syntheticDeployment))return Response.json({error:'TEST_DEPLOYMENT_CHANGED'},{status:409});
    syntheticDeployment=previousDeployment;
    return Response.json({deploymentId:syntheticDeployment,requestId});
  }},
};
const migrations=(await readdir(new URL('../../migrations/admin/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort();
async function reset(){
  dropNextUserResponse=false;
  syntheticDeployment=currentDeployment;smokeFailure=false;
  for(const db of [admin,control]){for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all())db.exec(`DROP TABLE "${name.replaceAll('"','""')}"`);}
  for(const name of migrations)admin.exec(await readFile(new URL(`../../migrations/admin/${name}`,import.meta.url),'utf8'));
  control.exec('CREATE TABLE control_ledger(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,state TEXT NOT NULL CHECK(json_valid(state)))');
  const state=initialState();state.applications={[applicationId]:{id:applicationId,ownerDigest:'a'.repeat(64),kind:'new',name:'合成申请人',note:'仅用于本机集成验证的申请说明',createdAt:Date.now()-3600000,state:'pending'}};
  const period=new Date().toISOString().slice(0,7);state.subjects[subjectId]={expiresAt:Date.now()+7*86400000,revoked:false};state.usages[`${subjectId}:${period}`]={understand:1,generate:2,summary:0};state.budgets[period]={spent:35,reserved:0};state.audit=[{at:Date.now()-3600000,event:'issued',subjectId}];
  state.requests[`${subjectId}:50000000-0000-4000-8000-000000000005`]={subjectId,requestId:'50000000-0000-4000-8000-000000000005',inputDigest:'b'.repeat(64),operation:'generate',createdAt:Date.now()-1800000,period,bound:300,status:'settled',cancelled:false,actualCost:35};
  control.prepare('INSERT INTO control_ledger VALUES(1,0,?)').run(JSON.stringify(state));
  admin.prepare('INSERT INTO admin_finance_events VALUES(?,?,?,?,?,?,?)').run('synthetic-fee',new Date().toISOString().slice(0,10),'ONBOARD_PLAN','settled',35,0,Date.now()-1800000);
  admin.prepare('INSERT INTO admin_quality_errors VALUES(?,?,?,?,?,?)').run('network','/settings','1.0.0','Chrome','Windows',Date.now()-3600000);
  const report={id:'60000000-0000-4000-8000-000000000006',synthetic:true,time:Date.now()-3600000,promptVersion:'v8.1.0',model:'synthetic-fixture',scenarios:[{scenario:'plan',passed:true,violations:0},{scenario:'tone',passed:true,violations:0}],durationMs:120,costMicros:0};admin.prepare('INSERT INTO admin_quality_evaluations VALUES(?,?,?)').run(report.id,report.time,JSON.stringify(report));
}
async function bodyOf(request){let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>65536)throw new Error('TEST_BODY_TOO_LARGE');chunks.push(chunk);}return Buffer.concat(chunks);}
const send=(response,status,data,headers={})=>{response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});response.end(JSON.stringify(data));};
const html='<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/@integration-entry"></script></body></html>';
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port,strictPort:true},esbuild:{jsx:'automatic'},plugins:[{
  name:'real-admin-integration',resolveId(id){if(id==='/@integration-entry')return '\0integration-entry';},
  load(id){if(id==='\0integration-entry')return "import React from 'react';import {createRoot} from 'react-dom/client';import '/src/i18n/index.ts';import '/src/ui/theme.css';import '/src/ui/shared.css';import {ManagementPage} from '/src/ui/pages/ManagementPage.tsx';import {startFeatureFlags} from '/src/application/feature-flags.ts';startFeatureFlags();createRoot(document.getElementById('root')).render(React.createElement(ManagementPage));";},
  configureServer(vite){vite.middlewares.use(async(request,response,next)=>{
    const path=new URL(request.url??'/',origin).pathname;
    try{
      if(path==='/__test/ready')return send(response,200,{ready:Boolean(worker),migrations});
      if(path==='/__test/reset'&&request.method==='POST'){await bodyOf(request);featureFailure=false;env.CONTROL_MODE='control-only';await reset();return send(response,200,{reset:true});}
      if(path==='/__test/drop-next-user-response'&&request.method==='POST'){await bodyOf(request);dropNextUserResponse=true;return send(response,200,{armed:true});}
      if(path==='/__test/features-mode'&&request.method==='POST'){featureFailure=JSON.parse((await bodyOf(request)).toString()).fail===true;return send(response,200,{fail:featureFailure});}
      if(path==='/__test/smoke-mode'&&request.method==='POST'){const data=JSON.parse((await bodyOf(request)).toString());smokeFailure=data.fail===true;return send(response,200,{fail:smokeFailure});}
      if(path==='/__test/session'&&request.method==='POST'){
        const {mode='fresh'}=JSON.parse((await bodyOf(request)).toString()||'{}');
        if(!['fresh','stale','invalid','none'].includes(mode))return send(response,400,{error:'INVALID_TEST_MODE'});
        const now=Math.floor(Date.now()/1000);let token=await new SignJWT({email:env.ADMIN_EMAIL}).setProtectedHeader({alg:'RS256'}).setSubject('synthetic-admin').setIssuer(accessIssuer).setAudience(env.ADMIN_ACCESS_AUD).setIssuedAt(now-(mode==='stale'?600:0)).setExpirationTime(now+3600).sign(privateKey);
        if(mode==='invalid')token=token.slice(0,token.lastIndexOf('.')+1)+'invalid';if(mode==='none')token='';
        return send(response,200,{mode},{'Set-Cookie':`integration-access=${token}; HttpOnly; SameSite=Strict; Path=/`});
      }
      if(path==='/__test/parity-fixture'&&request.method==='POST'){
        const {mode}=JSON.parse((await bodyOf(request)).toString());const state=JSON.parse(control.prepare('SELECT state FROM control_ledger WHERE id=1').get().state);
        if(mode==='pending'){const r=state.requests[`${subjectId}:50000000-0000-4000-8000-000000000005`];r.status='pending';delete r.actualCost;state.budgets[r.period]={spent:0,reserved:300};}
        else if(mode==='budget50'||mode==='budget80'){const period=new Date().toISOString().slice(0,7);state.budgets[period]={spent:mode==='budget50'?1750:2800,reserved:0};}
        else if(mode==='expired'){state.applications[applicationId].state='rejected';state.applications[applicationId].decidedAt=Date.now()-40*86400000;}
        else if(mode==='ai'){env.CONTROL_MODE='external';env.SUPPLIER_PROVIDER='deepseek';env.DEEPSEEK_API_KEY=randomBytes(32).toString('hex');env.SUPPLIER_ENDPOINT='https://api.deepseek.com/chat/completions';env.SUPPLIER_ORIGIN='https://api.deepseek.com';}
        else return send(response,400,{error:'INVALID_FIXTURE'});
        control.prepare('UPDATE control_ledger SET state=? WHERE id=1').run(JSON.stringify(state));return send(response,200,{mode});
      }
      if(path==='/__test/evidence'){
        const row=control.prepare('SELECT revision,state FROM control_ledger WHERE id=1').get();const state=JSON.parse(row.state);
        return send(response,200,{revision:row.revision,subjects:state.subjects,requests:state.requests,application:state.applications[applicationId],inviteRecords:state.invites,quotaRestorations:state.quotaRestorations??{},usage:state.usages,budgets:state.budgets,releaseStates:admin.prepare("SELECT * FROM admin_release_state").all(),aiEnabled:state.aiEnabled,applicationState:state.applications[applicationId]?.state,approvalEvents:state.audit.filter(item=>item.event===`application-approve:${applicationId}`).length,syntheticDeployment,invites:Object.keys(state.invites).length,audit:admin.prepare('SELECT actor,action,result,object_id FROM admin_audit').all(),migrations});
      }
      if(path.startsWith('/api/')){
        const headers=new Headers();for(const [key,value] of Object.entries(request.headers)){if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);}
        // Emulate only the loopback TLS-terminating proxy; foreign Origin remains foreign.
        if(headers.get('origin')===origin)headers.set('origin',workerOrigin);
        const token=(headers.get('cookie')??'').split(';').map(value=>value.trim()).find(value=>value.startsWith('integration-access='))?.slice('integration-access='.length);
        headers.delete('cf-access-jwt-assertion');if(token)headers.set('cf-access-jwt-assertion',token);
        const data=['GET','HEAD'].includes(request.method??'GET')?undefined:await bodyOf(request);
        const forwarded=new Request(workerOrigin+request.url,{method:request.method,headers,body:data});
        if(path==='/api/v1/features'){if(featureFailure)return send(response,503,{error:'TEST_FEATURES_UNAVAILABLE'});if(!await auth.verifyAdministrator(forwarded,env,async()=>publicKey))return send(response,403,{error:'TEST_ACCESS_REQUIRED'});}
        const result=await worker.fetch(forwarded,env);
        // Drop the successful upstream payload after commit and emit a gateway error.
        // A TCP reset may be transparently retried by Chromium, hiding the unknown state.
        if(path==='/api/v1/management/console/users/action'&&request.method==='POST'&&dropNextUserResponse){dropNextUserResponse=false;return send(response,503,{error:'OPERATION_RESULT_UNKNOWN'});}
        response.writeHead(result.status,Object.fromEntries(result.headers));response.end(Buffer.from(await result.arrayBuffer()));return;
      }
      if(path==='/admin'||path.startsWith('/admin/')){response.writeHead(200,{'Content-Type':'text/html'});response.end(await vite.transformIndexHtml(request.url,html));return;}
      next();
    }catch(error){console.error('Integration harness error:',error);send(response,500,{error:'INTEGRATION_HARNESS_ERROR'});}
  });},
}]});
const {createPreviewSimulationAdapter}=await server.ssrLoadModule('/src/backend/admin/releases/preview-simulation-adapter.ts');
const simulationAdapter=createPreviewSimulationAdapter();env.ADMIN_PREVIEW_SIMULATION={fetch:request=>simulationAdapter.fetch(request,{ADMIN_ENVIRONMENT:'preview',ADMIN_SIMULATION_DB:binding(admin),ADMIN_RELEASE_REGISTRY:env.ADMIN_RELEASE_REGISTRY})};
auth=await server.ssrLoadModule('/src/backend/management-auth.ts');
({initialState}=await server.ssrLoadModule('/src/backend/store.ts'));
const {createFitnessWorker}=await server.ssrLoadModule('/src/backend/fitness-worker.ts');
const {createDeepSeekWorker}=await server.ssrLoadModule('/src/backend/deepseek-worker.ts');
worker=createFitnessWorker(createDeepSeekWorker({transport:async()=>{throw new Error('MODEL_TRANSPORT_FORBIDDEN_IN_ADMIN_TEST');}}),(request,settings)=>auth.verifyAdministrator(request,settings,async()=>publicKey));
// Smoke probes use the actual local worker and local asset binding, never the internet.
globalThis.fetch=async(input,init)=>{
  const request=input instanceof Request?input:new Request(input,init);const url=new URL(request.url);
  if(url.origin!=='https://preview.invalid')throw new Error('EXTERNAL_NETWORK_FORBIDDEN_IN_ADMIN_TEST');
  if(smokeFailure&&url.pathname==='/api/v1/features')return new Response(null,{status:503});
  return worker.fetch(new Request(workerOrigin+url.pathname+url.search,request),env);
};
await reset();await server.listen();
console.log(`Real admin integration listening on ${origin}; SQLite + signed test Access, ${migrations.length} migrations.`);
async function shutdown(){await server.close();admin.close();control.close();process.exit(0);}
process.once('SIGTERM',()=>void shutdown());process.once('SIGINT',()=>void shutdown());
