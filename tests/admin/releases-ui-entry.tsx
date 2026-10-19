import '../../src/i18n/index';
import {createRoot} from 'react-dom/client';
import {ReleasesPage} from '../../src/ui/admin/releases/ReleasesPage';
import {PromptVersionsPage} from '../../src/ui/admin/releases/PromptVersionsPage';
import {adminWorkspaceTokens} from '../../src/ui/admin/tokens';
import '../../src/ui/admin/shell/admin-shell.css';
const params=new URLSearchParams(location.search);
createRoot(document.getElementById('root')!).render(<div className="admin-workspace" style={adminWorkspaceTokens}><aside>Fitness · 管理</aside><main><h1>{params.has('prompts')?'设置':'开关与发布'}</h1>{params.has('prompts')?<PromptVersionsPage language={params.get('language')??'zh'}/>:<ReleasesPage language={params.get('language')??'zh'}/>}</main></div>);
