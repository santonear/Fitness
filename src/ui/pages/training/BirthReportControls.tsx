import {BirthReportFields} from './PregnancySafetyPanel';
import {useMainline,workflow} from '../../mainline/context';
export function BirthReportControls(){
 const {data,locale,busy,run,navigate}=useMainline();
 if(data?.state?.coachProfile?.population?.kind!=='pregnant')return null;
 return <BirthReportFields locale={locale} busy={busy} onReport={input=>void run(async()=>{await workflow.reportBirth(input,data.metadata.dataRevision);navigate('/workout/recovery');})}/>;
}
