import {useState,StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {useRestVibration,restVibrationKey} from '../../../src/ui/pages/training/useRestVibration';
function Fixture(){const[last,setLast]=useState<string>(),[active,setActive]=useState(true),[count,setCount]=useState(0);useRestVibration(last,active);return <><button onClick={()=>localStorage.setItem(restVibrationKey,'on')}>enable</button><button onClick={()=>setLast(new Date().toISOString())}>set</button><button onClick={()=>setActive(!active)}>pause</button><button onClick={()=>setCount(count+1)}>render {count}</button></>}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture/></StrictMode>);
