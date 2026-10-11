import {useEffect,useState} from 'react';
import {adminRequest,reverifyAdmin,useAdminAction} from '../shared/api';
import {AdminDialog,AdminToast} from '../shared/components';
import type {ReleaseCommand,ReleaseOverview} from './types';

const storageKey='fitness-admin-release-operation';
function restoreCommand():ReleaseCommand|null {try{const value=JSON.parse(sessionStorage.getItem(storageKey)??'null') as ReleaseCommand|null;return value&&['flags','prompts','rollback','smoke'].includes(value.path)&&typeof value.requestId==='string'&&typeof value.body==='object'?value:null;}catch{return null;}}
export function useReleases(zh:boolean) {
  const [data,setData]=useState<ReleaseOverview|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
  const [command,setCommand]=useState<ReleaseCommand|null>(restoreCommand);const [attempted,setAttempted]=useState(!!command);const action=useAdminAction();
  const [dismissed,setDismissed]=useState(false);
  const refresh=async()=>{setLoading(true);try{setData(await adminRequest<ReleaseOverview>('releases'));setError('');}catch{setData(null);setError(zh?'暂时无法读取，后台可能已关闭或连接不可用。':'Unable to load. The console may be off or unavailable.');}finally{setLoading(false);}};
  useEffect(()=>{void refresh();},[]);
  const execute=async(value=command)=>{if(!value)return;setAttempted(true);const success=await action.run(()=>adminRequest(`releases/${value.path}`,value.body,value.requestId));if(success){setCommand(null);setAttempted(false);sessionStorage.removeItem(storageKey);action.setMessage(zh?'操作已完成。':'Change saved.');await refresh();}else if(!zh)action.setMessage('Result not confirmed. Retry this same request, or sign in again if verification is required.');};
  const stage=(value:Omit<ReleaseCommand,'requestId'>)=>{const next={...value,requestId:crypto.randomUUID()};setCommand(next);setAttempted(false);setDismissed(false);sessionStorage.setItem(storageKey,JSON.stringify(next));if(next.path==='smoke'||next.path==='flags'&&next.body.enabled===false)void execute(next);};
  const close=()=>{if(attempted){setDismissed(true);return;}setCommand(null);sessionStorage.removeItem(storageKey);};
  const dialog=<><AdminToast message={action.message}/>{command&&dismissed&&<p role="status"><button onClick={()=>setDismissed(false)}>{zh?'查看待确认操作':'Review pending operation'}</button></p>}<AdminDialog open={!!command&&!dismissed} title={command?.title??''} onClose={close} onConfirm={()=>void execute()} busy={action.busy} confirmLabel={attempted?(zh?'重试同一次':'Retry same request'):(zh?'确认':'Confirm')}><p>{command?.impact}</p>{attempted&&<p role="status">{zh?'这次请求尚待确认。请保留请求编号并重试同一次；重新登录不会自动执行。':'This request is awaiting confirmation. Retry the same request; signing in again does not execute it.'}</p>}{action.freshRequired&&<button onClick={reverifyAdmin}>{zh?'重新验证身份':'Verify identity again'}</button>}</AdminDialog></>;
  return {data,error,loading,refresh,stage,dialog,busy:action.busy||!!command};
}
