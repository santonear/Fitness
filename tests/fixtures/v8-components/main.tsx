import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MorphPanel, Toast, Composer, Button } from '../../../src/ui/components/common';
import '../../../src/themes/base/tokens.css';
import '../../../src/themes/qingci/tokens.css';
import '../../../src/themes/base/common.css';
function Fixture() {
 const trigger = useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false); const [value,setValue]=useState(''); const [message,setMessage]=useState<string|null>(null);
 return <main style={{padding:'var(--s5)',background:'var(--c-bg)',minHeight:'90vh'}}><button ref={trigger} className="v8-control v8-chip" onClick={()=>setOpen(true)}>深蹲 · 20 kg × 8</button><button>背景按钮</button><MorphPanel open={open} onClose={()=>setOpen(false)} triggerRef={trigger} title="深蹲"><p>按你实际做的填。</p><input aria-label="重量"/><Button onClick={()=>setMessage('已记下')}>保存</Button><Composer value={value} onChange={setValue} onSend={v=>{setMessage(v);setValue('');}}/></MorphPanel><Toast message={message} onDismiss={()=>setMessage(null)}/></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
