import {baseProfile} from '../../../tools/eval/training-engine-profiles';
import {it,expect} from 'vitest';
import {createContext} from '../../../src/engine/pipeline';
import {candidatesFor,isHardEligible,equipmentAvailable} from '../../../src/engine/candidates';
import {condition,Rules} from '../../../src/engine/data';
import type {EngineProfile,Slot} from '../../../src/engine/contracts';
const profiles:EngineProfile[]=[{"goal": "health", "level": "intermediate", "trainingAgeWeeks": 25, "daysPerWeek": 6, "sessionMinutes": 30, "equipment": ["none"], "place": "home", "constraints": {"noJump": false, "quiet": false, "space": "mat"}, "cautions": ["knee"], "population": {"kind": "older_adult", "fallsAnswers": [false, false, false, false], "balanceCautious": true}, "screening": {"parqAllNo": true, "parqAnswers": [false, false, false, false, false, false, false], "knownCondition": false, "knownCmrDisease": false, "symptoms": false, "activityStatus": "inactive", "restingBp": "known_below_threshold", "acuteIllness": false, "completedAt": "2026-10-01T00:00:00.000Z", "lastScreenedAt": "2026-10-01T00:00:00.000Z"}, "preferences": {"excludedExerciseIds": [], "cannotDo": []}, "birthYearMonth": "1956-06", "asOfDate": "2026-10-15", "locale": "zh"}, {"goal": "start_moving", "level": "intermediate", "trainingAgeWeeks": 26, "daysPerWeek": 6, "sessionMinutes": 10, "equipment": ["none", "dumbbell", "resistance-band", "loop-band", "flat-bench"], "place": "home", "constraints": {"noJump": true, "quiet": false, "space": "small"}, "cautions": ["knee", "back", "shoulder", "wrist"], "population": {"kind": "older_adult", "fallsAnswers": [false, false, false, false], "balanceCautious": true}, "screening": {"parqAllNo": true, "parqAnswers": [false, false, false, false, false, false, false], "knownCondition": false, "knownCmrDisease": false, "symptoms": false, "activityStatus": "inactive", "restingBp": "known_below_threshold", "acuteIllness": false, "completedAt": "2026-10-01T00:00:00.000Z", "lastScreenedAt": "2026-10-01T00:00:00.000Z"}, "preferences": {"excludedExerciseIds": [], "cannotDo": ["walking_carry", "jumping", "overhead", "kneeling"]}, "birthYearMonth": "1956-06", "asOfDate": "2026-10-15", "locale": "zh"}];
const slot:Slot={id:'balance',role:'balance',patterns:['balance'],priority:10,optional:false,sourceRuleId:'older.template.balance_required'};
it.each(profiles)('diagnoses absent hard balance candidates without weakening safety or pretending wall ownership',input=>{
 const profile=baseProfile({...input,screening:{...input.screening,cmrSymptoms:Object.fromEntries(new Rules().get('safety.screen.cmr_symptoms').symptoms.map((key:string)=>[key,false]))},householdSupport:false});
 const ctx=createContext(profile),balance=ctx.rules.data.exercises.filter(e=>e.primary_pattern==='balance');
 expect(ctx.gate.status).not.toBe('blocked');expect(balance).toHaveLength(9);
 expect(balance.filter(e=>isHardEligible(e,profile,ctx.gate,ctx))).toHaveLength(0);
 const support=balance.filter(e=>!e.flags.includes('balance_demand'));
 expect(support).toHaveLength(4);expect(support.every(e=>e.equipment_required.includes('wall')&&!equipmentAvailable(e,profile))).toBe(true);
 const unsupported=balance.filter(e=>e.flags.includes('balance_demand'));
 expect(unsupported.every(e=>condition(ctx.rules.get('older.exclude.balance_cautious').exclude_if,e,ctx.gate.restrictions.user))).toBe(true);
 // A separately declared wall-equipped profile is a positive control, never an alteration of the real input.
 const withWall:EngineProfile={...profile,equipment:[...profile.equipment,'wall']},supportedCtx=createContext(withWall),pool=candidatesFor(slot,withWall,supportedCtx.gate,supportedCtx);
 expect(pool.length).toBeGreaterThan(0);expect(pool.every(e=>e.primary_pattern==='balance')).toBe(true);
});
