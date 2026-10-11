import {accessCopy,accessReason,hadConfirmedAccess} from '../../application/ai-access';
import {useAccessStatus} from '../useAccessStatus';
import {Button,Sheet} from './common';
export function AccessStatusCard({locale}:{locale:'zh'|'en'}){const {status,loading,failed,refresh}=useAccessStatus();const t=accessCopy[locale],reason=status?accessReason(status):failed?'connection':undefined;return <Sheet><h2>{t.title}</h2><p role="status">{loading?t.loading:reason==='invalid'?(status?.qualification==='none'&&!hadConfirmedAccess()?t.none:t.invalid):reason?t.reasons[reason]:status?t.active:t.loading}</p><Button disabled={loading} onClick={()=>void refresh()}>{t.refresh}</Button>{reason==='invalid'&&<a href="/trial">{t.restore}</a>}</Sheet>}
