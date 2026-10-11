import type {AssistantRequest,AssistantStreamEvent} from './contracts';
export class AssistantError extends Error {constructor(code:string,public resetAt?:string){super(code);}}
/** A single user send; model retries belong to the server and never duplicate admission. */
export async function sendAssistant(request:AssistantRequest,signal:AbortSignal,onEvent:(event:AssistantStreamEvent)=>void,fetcher:typeof fetch=fetch){
 let response:Response;try{response=await fetcher('/api/v1/assistant/chat',{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});}catch(error){if(signal.aborted)throw error;throw new AssistantError('NETWORK_ERROR');}
 if(!response.ok){const body=await response.json().catch(()=>({}));throw new AssistantError(typeof body.error==='string'?body.error:'NETWORK_ERROR',body.resetAt);}
 if(!response.body)throw new AssistantError('NETWORK_ERROR');
 const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',done=false;
 try{while(true){const part=await reader.read();pending=(pending+decoder.decode(part.value,{stream:!part.done})).replace(/\r\n/g,'\n');let boundary:number;
 while((boundary=pending.indexOf('\n\n'))>=0){const frame=pending.slice(0,boundary);pending=pending.slice(boundary+2);const data=frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(!data)continue;const event=JSON.parse(data) as AssistantStreamEvent;if(event.type==='error')throw new AssistantError(event.code,event.resetAt);if(event.type==='done')done=true;onEvent(event);}
 if(part.done)break;}
 if(!done)throw new AssistantError('NETWORK_ERROR');
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
