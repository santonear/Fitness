import {createRoot} from 'react-dom/client';
import {ReleasesPage} from '../../src/ui/admin/releases/ReleasesPage';
import {PromptVersionsPage} from '../../src/ui/admin/releases/PromptVersionsPage';
import '../../src/ui/admin/shell/tokens.css';
import '../../src/ui/admin/shell/admin-shell.css';
const params=new URLSearchParams(location.search);
createRoot(document.getElementById('root')!).render(<div className="admin-workspace"><aside>Fitness · 管理</aside><main>{params.has('prompts')?<PromptVersionsPage language={params.get('language')??'zh'}/>:<ReleasesPage language={params.get('language')??'zh'}/>}</main></div>);
