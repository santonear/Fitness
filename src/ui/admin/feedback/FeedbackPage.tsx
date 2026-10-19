import {useEffect,useState} from 'react';
import {adminRequest,useAdminAction} from '../shared/api';
import {adminDate} from '../shared/format';
import {AdminToast} from '../shared/components';
import type {FeedbackRow} from '../../../backend/admin/feedback';

type Filter='open'|'all';
const filters:readonly [Filter,string,string][]=[['open','未处理','Open'],['all','全部','All']];
/** 留言: messages users chose to send from 我的 → 给我们留言. Nothing else about the user is shown. */
export function FeedbackPage({language='zh',onChange}:{language?:string;onChange?:()=>void}){
 const zh=language!=='en';const[filter,setFilter]=useState<Filter>('open');const[items,setItems]=useState<FeedbackRow[]>([]);const[counts,setCounts]=useState({open:0,total:0});
 const[version,setVersion]=useState(0);const[error,setError]=useState(false);const[loaded,setLoaded]=useState(false);const action=useAdminAction();
 useEffect(()=>{let live=true;adminRequest<{items:FeedbackRow[];open:number;total:number}>(`feedback?filter=${filter}`).then(r=>{if(live){setItems(r.items);setCounts({open:r.open,total:r.total});setError(false);setLoaded(true)}}).catch(()=>{if(live)setError(true)});return()=>{live=false}},[filter,version]);
 async function mark(id:string,status:'new'|'handled'){if(await action.run(()=>adminRequest('feedback/status',{id,status}))){setVersion(n=>n+1);onChange?.()}}
 return <>{error&&<p role="alert">{zh?'留言暂时不可用':'Messages unavailable'}</p>}
  <p className="admin-muted admin-note">{zh?'这里只有用户在“我的 → 给我们留言”里主动发给我们的内容；用户发送前已被告知会发给运营者。不附带训练、健康或聊天记录。':'Only what users chose to send from Me → Send us a message. They were told it goes to the operator before sending. No training, health or chat records are attached.'}</p>
  <div className="admin-section-head"><div className="admin-segmented" role="group" aria-label={zh?'按状态筛选留言':'Filter messages by status'}>{filters.map(([id,zhLabel,enLabel])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>setFilter(id)}>{zh?zhLabel:enLabel} {id==='open'?counts.open:counts.total}</button>)}</div></div>
  <section className="admin-card admin-table-card admin-stack" aria-label={zh?'留言列表':'Messages'}><table><thead><tr><th scope="col">{zh?'时间':'Time'}</th><th scope="col">{zh?'用户 ID':'User ID'}</th><th scope="col">{zh?'留言':'Message'}</th><th scope="col">{zh?'联系方式':'Contact'}</th><th scope="col">{zh?'状态':'Status'}</th><th scope="col">{zh?'操作':'Actions'}</th></tr></thead>
  <tbody>{items.map(f=><tr key={f.id} data-state={f.status}><th scope="row" className="admin-nowrap"><time dateTime={new Date(f.createdAt).toISOString()}>{adminDate(f.createdAt,zh)}</time></th><td className="admin-id" data-label={zh?'用户 ID':'User ID'}>{f.subjectShortId??<span className="admin-muted">{zh?'匿名':'Anonymous'}</span>}</td>
   <td className="admin-notes admin-block-cell" data-label={zh?'留言':'Message'}><p>{f.message}</p></td><td className="admin-block-cell" data-label={zh?'联系方式':'Contact'}>{f.contact??<span className="admin-muted">{zh?'未留':'None'}</span>}</td>
   <td data-label={zh?'状态':'Status'}><span className="admin-pill" data-tone={f.status==='handled'?'ok':undefined}>{f.status==='handled'?(zh?'已处理':'Handled'):(zh?'未处理':'Open')}</span></td>
   <td className="admin-block-cell">{f.status==='new'?<button className="primary" disabled={action.busy} onClick={()=>void mark(f.id,'handled')}>{zh?'标为已处理':'Mark handled'}</button>:<button disabled={action.busy} onClick={()=>void mark(f.id,'new')}>{zh?'改回未处理':'Reopen'}</button>}</td></tr>)}</tbody></table>
  {loaded&&!items.length&&<p className="admin-empty admin-table-empty">{filter==='open'?(zh?'没有未处理的留言。':'No open messages.'):(zh?'还没有留言。':'No messages yet.')}</p>}</section>
  <AdminToast message={action.message}/></>;
}
