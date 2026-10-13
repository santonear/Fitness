import {AssistantSettingsCard} from './AssistantSettingsCard';
import './releases.css';
export function PromptVersionsPage({language='zh'}:{language?:string}){
 return <section className="admin-releases"><AssistantSettingsCard language={language}/></section>;
}
