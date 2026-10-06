import type {AiRequest} from '../backend/contracts';
import type {AiContextCapture} from '../application/ai-context';
import {canonical} from '../backend/contracts';
function conditions(capture:AiContextCapture){const {updatedAt:_updatedAt,daysPerWeek:_days,trainingWeekdays:_weekdays,...fields}=capture.profile.trainingPreferences??{};return canonical(fields);}
export function assertPreviewCurrent(request:AiRequest,original:AiContextCapture,current:AiContextCapture):void{
 if(current.restoreGeneration!==request.restoreGeneration)throw new Error('STALE_RESTORE_GENERATION');
 if(request.operation==='understand')return;
 if(request.operation==='summary')throw new Error('INVALID_INPUT');
 if(current.profile.timeZone!==request.timeZone||conditions(original)!==conditions(current))throw new Error('STALE_SENDING_SCOPE');
 if(request.history){if(!current.history)throw new Error('STALE_SENDING_SCOPE');
  const previous=JSON.parse(request.history.text),next=JSON.parse(current.history.text);next.capturedAt=previous.capturedAt;next.dataRevision=previous.dataRevision;
  if(canonical(previous)!==canonical(next))throw new Error('STALE_SENDING_SCOPE');
 }
}
