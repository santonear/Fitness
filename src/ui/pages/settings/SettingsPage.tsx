import {AssistantPreferencesPanel} from './AssistantPreferencesPanel';
import {AccessStatusCard} from '../../components/AccessStatusCard';
import { DeletedPlans } from './DeletedPlans';
import { planLifecycleCopy } from '../../../i18n/features/plan/lifecycle';
import { anonymousUsageEnabled, setAnonymousUsage } from '../../../application/monitoring-client';
import { operationsCopy } from '../../../i18n/features/settings/operations';
import { SystemNotifications } from './SystemNotifications';
import { restVibrationKey, timerSoundKey } from '../training/useRestVibration';
import settingsZh from '../../../i18n/features/settings/zh.json';
import settingsEn from '../../../i18n/features/settings/en.json';
import { meCopy } from '../../../i18n/features/settings/me';
import { bodyCopy } from '../../../i18n/features/onboarding/body';
import { useMainline } from '../../mainline/context';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { BackupPanel } from '../../components/BackupPanel';
import { ReminderSettings } from './ReminderSettings';
import { profileService } from '../../../application/profile';
import i18n from '../../../i18n';
import { lifestyleCopy } from '../../../i18n/features/settings/lifestyle';
import { useFeature } from '../../useFeature';
import { getAvailableThemes } from '../../../themes/registry';
import { isFeatureEnabled, subscribeFeatureFlags } from '../../../application/feature-flags';
import { Card, PrimaryButton, ThemePicker, Yaya } from '../../components/kit';
import { MyChangesCard } from './MyChangesPage';
import './settings.css';

type Section = '' | 'reminders' | 'backup' | 'privacy' | 'assistantPreferences' | 'deletedPlans';
/** One settings entry: a full-width row that opens a page or an inline section. */
function Row({ label, hint, onClick, expanded, children }: { label: string; hint?: string; onClick: () => void; expanded?: boolean; children?: ReactNode }) {
  return <li><button type="button" className="v9-row v8-press" aria-expanded={expanded} onClick={onClick}><span>{label}{hint && <small>{hint}</small>}</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-open={expanded ? 'true' : 'false'}><path d="M9 6l6 6-6 6" /></svg></button>{expanded && children && <div className="v9-row-panel">{children}</div>}</li>;
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className="v9-settings-group" aria-label={title}><h2>{title}</h2><Card variant="raised" padding="none" as="div"><ul className="v9-rows">{children}</ul></Card></section>;
}

/** 我的 (V9 settings): 我 (profile, changes, body, screening) / 营养建议 / 训练设置 / 芽芽与 AI / 数据与隐私 / 通用; each entry once. */
export function SettingsPage(){const bodyEnabled=useFeature('bodyProfile');const engineEnabled=useFeature('trainingEngine');const{data,navigate,locale,run,busy,restartPlanning,appearance}=useMainline();const location=useLocation();const[section,setSection]=useState<Section>(location.hash==='#reminders'?'reminders':location.hash==='#backup'?'backup':'');const copy=locale==='zh'?settingsZh:settingsEn,me=meCopy[locale]; const [vibration,setVibration]=useState(()=>{try{return localStorage.getItem(restVibrationKey)==='on';}catch{return false;}}); const planLifecycle=useFeature('planLifecycle'); const analytics=useFeature('anonymousUsage'), errorReports=useFeature('errorReports'); const [optedIn,setOptedIn]=useState(anonymousUsageEnabled); const nutritionEnabled=useFeature('nutrition'), importEnabled=useFeature('activityImport'), aiEnabled=useFeature('aiAssistantV2'); const [hasNutrition,setHasNutrition]=useState(false); useEffect(()=>{void import('../../../persistence/repository').then(({repository})=>repository.db.nutritionRecords.count()).then(n=>setHasNutrition(n>0));},[]); const vibrationSupported=typeof navigator.vibrate==='function'; const [timerSound,setTimerSound]=useState(()=>{try{return localStorage.getItem(timerSoundKey)==='on';}catch{return false;}});
 const discovery=useSyncExternalStore(subscribeFeatureFlags,()=>isFeatureEnabled('themeDiscovery'),()=>false);
 const builtin=getAvailableThemes(false),extra=getAvailableThemes(discovery).filter(theme=>!builtin.some(item=>item.id===theme.id));
 useEffect(()=>{void i18n.changeLanguage(locale);},[locale]);
 const toggle=(next:Section)=>setSection(section===next?'':next);
 const version=data?.version;
 const nutritionEntry=nutritionEnabled||hasNutrition||aiEnabled;
 return <main className="v9-settings"><header className="v9-settings-head"><span className="v9-settings-kicker" aria-hidden="true">me</span><h1 className="v9-display">{me.title}</h1><i className="v9-brand-dash" aria-hidden="true"/></header>
 <section className="v9-settings-group v9-settings-me" aria-label={me.me}><h2>{me.me}</h2>
  <Card variant="raised" padding="md" as="section" className="v9-settings-profile" aria-label={me.profile}>
   <Yaya pose="thanks" size={64} alt=""/>
   <div className="v9-settings-profile-text"><span>{me.goal}</span><strong>{version?.goalText||me.noPlan}</strong>{version&&<span>{me.summary.replace('{weekly}',String(version.weeklyTarget)).replace('{minutes}',String(version.sessionMinutes))}</span>}<span className="v9-settings-thanks">{me.thanks}</span></div>
   <div className="v9-settings-profile-actions">{version&&<PrimaryButton tone="text" size="sm" onClick={()=>navigate('/plans')}>{me.goalPlan}</PrimaryButton>}<PrimaryButton tone="quiet" size="sm" onClick={restartPlanning}>{copy.settingsPage3}</PrimaryButton></div>
  </Card>
  <MyChangesCard/>
  <Card variant="raised" padding="none" as="div"><ul className="v9-rows">
   <Row label={me.changes} hint={me.changesHint} onClick={()=>navigate('/settings/changes')}/>
   {(bodyEnabled||data?.profile?.bodyDetails)&&<Row label={bodyCopy[locale].settingsTitle} onClick={()=>navigate('/settings/body')}/>}
   {(engineEnabled||data?.state?.coachProfile?.healthStorageConsent)&&<Row label={me.screening} onClick={()=>navigate('/settings/engine')}/>}
  </ul></Card>
 </section>
 {nutritionEntry&&<Group title={me.nutrition}>
  <Row label={me.nutrition} hint={nutritionEnabled||hasNutrition?`${me.nutritionRow} · ${me.nutritionRecords}`:me.nutritionRow} onClick={()=>navigate('/settings/nutrition')}/>
 </Group>}
 <Group title={me.training}>
  <Row label={copy.settingsPage0} expanded={section==='reminders'} onClick={()=>toggle('reminders')}><ReminderSettings locale={locale}/></Row>
  {importEnabled&&<Row label={lifestyleCopy[locale].importActivity} onClick={()=>navigate('/settings/import')}/>}
  <li><label className="v9-row v9-row-check"><span>{copy.timerSound}</span><input type="checkbox" checked={timerSound} onChange={event=>{const value=event.target.checked;try{localStorage.setItem(timerSoundKey,value?'on':'off');setTimerSound(value);}catch{/* Keep the saved preference unchanged. */}}}/></label></li>
  <li><label className="v9-row v9-row-check"><span>{copy.restVibration}{!vibrationSupported&&<small>{copy.vibrationUnavailable}</small>}</span><input type="checkbox" checked={vibration} disabled={!vibrationSupported} onChange={event=>{const value=event.target.checked;try{localStorage.setItem(restVibrationKey,value?'on':'off');setVibration(value);}catch{/* Keep the saved preference unchanged. */}}}/></label></li>
 </Group>
 <Group title={me.yaya}>
  <li className="v9-row-block"><AccessStatusCard locale={locale}/></li>
  <Row label={copy.trial} onClick={()=>navigate('/trial')}/>
  <Row label={me.remembered} expanded={section==='assistantPreferences'} onClick={()=>toggle('assistantPreferences')}><AssistantPreferencesPanel locale={locale}/></Row>
 </Group>
 <Group title={me.data}>
  <Row label={copy.settingsPage2} expanded={section==='privacy'} onClick={()=>toggle('privacy')}><section><h2>{copy.settingsPage4}</h2><p>{copy.settingsPage5}</p><p>{operationsCopy[locale].dietPrivacy}</p></section></Row>
  <Row label={copy.settingsPage1} expanded={section==='backup'} onClick={()=>toggle('backup')}><BackupPanel/></Row>
  {planLifecycle&&<Row label={planLifecycleCopy[locale].trash} expanded={section==='deletedPlans'} onClick={()=>toggle('deletedPlans')}><DeletedPlans/></Row>}
  {analytics&&<li><label className="v9-row v9-row-check"><span>{operationsCopy[locale].analytics}<small>{operationsCopy[locale].analyticsHint}</small></span><input type="checkbox" checked={optedIn} onChange={e=>{try{setAnonymousUsage(e.target.checked);setOptedIn(e.target.checked);}catch{/* No opt-in when storage fails. */}}}/></label></li>}
  {errorReports&&<li className="v9-row-block"><p>{operationsCopy[locale].errorHint}</p></li>}
 </Group>
 <section className="v9-settings-group" aria-label={me.general}><h2>{me.general}</h2>
  <div className="v9-settings-theme"><h3>{copy.appearanceStyle}</h3><ThemePicker themes={builtin} value={appearance.theme} onChange={appearance.change} locale={locale} label={copy.appearanceStyle}/>{extra.length>0&&<PrimaryButton tone="text" size="sm" onClick={()=>navigate('/settings/appearance')}>{copy.appearancePage0}</PrimaryButton>}</div>
  <Card variant="raised" padding="none" as="div"><ul className="v9-rows">
   <li><label className="v9-row v9-row-select"><span>{copy.language}</span><select value={locale} disabled={busy} onChange={event=>{const next=event.target.value==='en'?'en':'zh';void run(async()=>{await profileService.setLocale(next);await i18n.changeLanguage(next);});}}><option value="zh">{copy.chinese}</option><option value="en">{copy.english}</option></select></label></li>
   <li className="v9-row-block v9-row-block-empty"><SystemNotifications locale={locale}/></li>
  </ul></Card>
 </section>
 </main>;}
