import {conversationSchema} from './assistant-conversation';
import {bodyDetailsSchema} from './body-profile';
import { z } from 'zod';
import {engineProfileSchema,prescriptionSchema,enginePlanSchema,cautionSchema,patternSchema,engineItemSchema} from '../engine/contracts';
import { nutritionRecordSchema, activityImportReceiptSchema } from './lifestyle';
import { schedulingFields, validateScheduling, setTimingSchema } from './training-time';
import { knownExerciseIds } from '../catalog/registry';
import { EQUIPMENT } from '../catalog/taxonomy';
import { guidedStateSchema } from './guided-contracts';
import { FITNESS_TEST_ITEMS, HOME_PANEL_STYLES, ROUTES } from './plan-upgrade';
export const localeSchema = z.enum(['zh', 'en']);
export const uuidSchema = z.uuid();
export const exerciseIdSchema = z.uuid().refine(id => knownExerciseIds.has(id), 'Unknown exercise ID');
export const localDateSchema = z.iso.date();
export const utcTimestampSchema = z.iso.datetime();
export const timeZoneSchema = z.string().refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
  catch { return false; }
}, 'Expected an IANA time zone');
const metricTypeSchema = z.enum(['reps_load', 'reps', 'duration', 'duration_distance']);
const categorySchema = z.enum(['strength', 'cardio', 'bodyweight']);
const equipmentSchema = z.enum(EQUIPMENT);
const bilingualTextSchema = z.strictObject({ zh: z.string().min(1), en: z.string().min(1) });
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonnegative = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const setMetricsSchema = z.discriminatedUnion('metricType', [
  z.strictObject({ metricType: z.literal('reps_load'), reps: positive, loadGrams: nonnegative }),
  z.strictObject({ metricType: z.literal('reps'), reps: positive }),
  z.strictObject({ metricType: z.literal('duration'), durationSeconds: positive }),
  z.strictObject({ metricType: z.literal('duration_distance'), durationSeconds: positive, distanceMeters: nonnegative.optional() }),
]);
const entityFields = { id: uuidSchema, createdAt: utcTimestampSchema, updatedAt: utcTimestampSchema, revision: nonnegative };
export const exerciseSchema = z.strictObject({
  id: uuidSchema, catalogVersion: positive, name: bilingualTextSchema,
  category: categorySchema, equipment: equipmentSchema, metricType: metricTypeSchema,
  allowedMetrics: z.array(z.enum(['reps', 'loadGrams', 'durationSeconds', 'distanceMeters'])),
  steps: z.strictObject({ zh: z.array(z.string()).min(1), en: z.array(z.string()).min(1) }),
  cautions: z.strictObject({ zh: z.array(z.string()), en: z.array(z.string()) }),
  imageAssetId: z.string().optional(), videoAssetId: z.string().optional(),
});
export const trainingPreferencesSchema = z.strictObject({
  goal: z.string().optional(), experience: z.string().optional(), availableEquipment: z.array(z.string()).optional(),
  daysPerWeek: positive.max(7).optional(), sessionMinutes: positive.optional(), heightCm: positive.optional(),
  weightGrams: positive.optional(), constraints: z.string().optional(), updatedAt: utcTimestampSchema,
  exercisePreferences: z.array(categorySchema).optional(),
  trainingLocation: z.enum(['home', 'gym', 'outdoors', 'other']).optional(),
  trainingWeekdays: z.array(positive.max(7)).min(1).max(7).optional(),
}).superRefine((preferences, context) => {
  if (!preferences.trainingWeekdays) return;
  if (new Set(preferences.trainingWeekdays).size !== preferences.trainingWeekdays.length) {
    context.addIssue({ code: 'custom', path: ['trainingWeekdays'], message: 'Training weekdays must be distinct' });
  }
  if (preferences.daysPerWeek !== undefined && preferences.trainingWeekdays.length !== preferences.daysPerWeek) {
    context.addIssue({ code: 'custom', path: ['trainingWeekdays'], message: 'Training weekday count must equal daysPerWeek' });
  }
});
export const localProfileSchema = z.strictObject({
  ...entityFields, bodyDetails: bodyDetailsSchema.optional(), locale: localeSchema, timeZone: timeZoneSchema, units: z.literal('metric'), trainingPreferences: trainingPreferencesSchema.optional(),
});
export const plannedExerciseSchema = z.strictObject({
  exerciseId: exerciseIdSchema, order: nonnegative, targetSets: z.array(setMetricsSchema).min(1), setTimings: z.array(setTimingSchema).min(1).optional(), notes: z.string().optional(),
}).superRefine((exercise, context) => {
  if (exercise.setTimings && (exercise.setTimings.length !== exercise.targetSets.length || exercise.targetSets.some((set, index) => 'durationSeconds' in set && set.durationSeconds !== exercise.setTimings![index]?.durationSeconds))) context.addIssue({ code: 'custom', message: 'Set timing must match each target set' });
});
export const planDaySchema = z.strictObject({
  dayId: uuidSchema, weekIndex: positive.max(12), dayOfWeek: positive.max(7), exercises: z.array(plannedExerciseSchema).min(1),
});
export const goalSnapshotSchema = z.strictObject({ goal: z.string(), trainingPreferences: trainingPreferencesSchema.optional() });
const generationMetadataSchema = z.strictObject({
  requestId: uuidSchema.optional(), model: z.string().optional(), promptVersion: z.string().optional(), generatedAt: utcTimestampSchema.optional(), memoRevision: nonnegative.optional(),
});
export const legacyPlanVersionSchema = z.strictObject({
  ...entityFields, planId: uuidSchema, versionNumber: positive, goalSnapshot: goalSnapshotSchema,
  startDate: localDateSchema, scheduleTimeZone: timeZoneSchema,
  durationWeeks: positive.max(12), daysPerWeek: positive.max(7), days: z.array(planDaySchema).min(1), generationMetadata: generationMetadataSchema.optional(),
});
export const datePlanDaySchema = z.strictObject({ dayId: uuidSchema, date: localDateSchema, exercises: z.array(plannedExerciseSchema).min(1) });
export const datePlanVersionSchema = z.strictObject({
  ...entityFields, model: z.literal('date-day'), planId: uuidSchema, versionNumber: positive, goalSnapshot: goalSnapshotSchema,
  startDate: localDateSchema, scheduleTimeZone: timeZoneSchema, days: z.tuple([datePlanDaySchema]), generationMetadata: generationMetadataSchema.optional(),
}).refine(version => version.days[0].date === version.startDate, 'Day date must match its original date');
export const planVersionSchema = z.union([datePlanVersionSchema, legacyPlanVersionSchema]);
export const planSchema = z.strictObject({
  ...entityFields, name: z.string().min(1), source: z.enum(['ai', 'manual']), status: z.enum(['draft', 'active', 'archived']),
  currentVersionId: uuidSchema, startDate: localDateSchema, scheduleTimeZone: timeZoneSchema, deletedAt: utcTimestampSchema.optional(),
  model: z.literal('date-day').optional(),
});
export const exerciseSnapshotSchema = exerciseSchema.omit({ steps: true, cautions: true, imageAssetId: true, videoAssetId: true }).extend({
  exerciseInstanceId: uuidSchema, exerciseId: exerciseIdSchema, order: nonnegative, targetSets: z.array(setMetricsSchema), setTimings: z.array(setTimingSchema).optional(), notes: z.string().optional(), originalExerciseId: exerciseIdSchema.optional(),
});
export const workoutSessionSchema = z.strictObject({
  ...entityFields, planVersionId: uuidSchema.optional(), plannedDayId: uuidSchema.optional(), status: z.enum(['in_progress', 'completed', 'abandoned']),
  startedAt: utcTimestampSchema, completedAt: utcTimestampSchema.optional(), localDate: localDateSchema, timeZone: timeZoneSchema,
  originalExerciseSnapshots: z.array(exerciseSnapshotSchema), exerciseSnapshots: z.array(exerciseSnapshotSchema), notes: z.string().optional(),
});
export const setRecordSchema = z.strictObject({
  ...entityFields, sessionId: uuidSchema, exerciseInstanceId: uuidSchema, order: nonnegative, metricType: metricTypeSchema,
  reps: positive.optional(), loadGrams: nonnegative.optional(), durationSeconds: positive.optional(), distanceMeters: nonnegative.optional(), completed: z.boolean(), notes: z.string().optional(),
}).superRefine((record, context) => {
  const { metricType, reps, loadGrams, durationSeconds, distanceMeters } = record;
  const fields = { reps, loadGrams, durationSeconds, distanceMeters };
  const allowed = metricType === 'reps_load' ? ['reps', 'loadGrams'] : metricType === 'reps' ? ['reps'] : metricType === 'duration' ? ['durationSeconds'] : ['durationSeconds', 'distanceMeters'];
  if (Object.entries(fields).some(([key, value]) => value !== undefined && !allowed.includes(key))) context.addIssue({ code: 'custom', message: 'Metric does not belong to this type' });
  if (record.completed && !setMetricsSchema.safeParse({ metricType, ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) }).success) context.addIssue({ code: 'custom', message: 'Completed sets require valid metrics' });
});
export const scheduledWorkoutSchema = z.strictObject({
  ...entityFields, planVersionId: uuidSchema, plannedDayId: uuidSchema, originalDate: localDateSchema, scheduledDate: localDateSchema,
  ...schedulingFields, status: z.enum(['pending', 'skipped']), completedSessionId: uuidSchema.optional(), hiddenAt: utcTimestampSchema.optional(),
}).superRefine(validateScheduling);
// Restore-only schema: preserve malformed historical duration values without weakening new scheduling writes.
const legacyBackupScheduleSchema = z.strictObject({
  ...entityFields, planVersionId: uuidSchema, plannedDayId: uuidSchema, originalDate: localDateSchema, scheduledDate: localDateSchema,
  startTime: schedulingFields.startTime, durationMinutes: z.unknown().optional(), status: z.enum(['pending', 'skipped']),
  completedSessionId: uuidSchema.optional(), hiddenAt: utcTimestampSchema.optional(),
});
/** bodyFatPercent: optional, user-entered (我的变化); absent on older rows means not measured. */
export const bodyWeightObservationSchema = z.strictObject({ ...entityFields, localDate: localDateSchema, timeZone: timeZoneSchema, weightGrams: positive, bodyFatPercent: z.number().min(3).max(70).optional() });
/** A new or edited entry: 20–300 kg. Stored rows and backups keep the looser schema above so older records stay valid. */
export const bodyWeightInputSchema = bodyWeightObservationSchema.extend({ weightGrams: positive.min(20_000).max(300_000) });
export const metadataSchema = z.strictObject({
  schemaVersion: positive, localProfileId: uuidSchema, catalogVersion: positive, revision: nonnegative, dataRevision: nonnegative,
  importedAt: utcTimestampSchema.optional(), upgradedAt: utcTimestampSchema.optional(),
  restoreGeneration: nonnegative.optional(),
  assistantScheduleRecoveryV2At: utcTimestampSchema.optional(),
});
const memoSessionSchema = z.strictObject({ session: workoutSessionSchema, sets: z.array(setRecordSchema), planVersionSnapshot: planVersionSchema.optional() });
export const trainingMemoSchema = z.strictObject({ schemaVersion: positive, revision: nonnegative, updatedAt: utcTimestampSchema, sourceRevision: nonnegative, sessions: z.array(memoSessionSchema) });
export const aiMemoryNoteSchema = z.strictObject({ ...entityFields, memoRevision: nonnegative, generatorVersion: z.string(), locale: localeSchema, suggestion: z.string(), explanation: z.string(),
  kind:z.enum(['dislike_exercise','cannot_do','caution_area','preferred_days','equipment']).optional(),
  value:z.union([z.string().min(1).max(200),z.array(z.string().min(1).max(80)).min(1).max(7)]).optional(),
}).superRefine((note,ctx)=>{if((note.kind===undefined)!==(note.value===undefined))ctx.addIssue({code:'custom',path:['value'],message:'Preference kind and value must be provided together'});});
export const mediaAssetSchema = z.strictObject({
  id: z.string(), type: z.enum(['image', 'video']), provider: z.enum(['r2', 'youtube']),
  url: z.url().optional(), youtubeVideoId: z.string().optional(), creator: z.string(), language: z.string(),
  altText: bilingualTextSchema, caption: bilingualTextSchema, source: z.string(), license: z.string(),
  attribution: z.string(), checkedAt: utcTimestampSchema.optional(),
  embeddingStatus: z.enum(['unreviewed', 'available', 'unavailable']), version: positive,
});
export const timerStateSchema = z.strictObject({
  ...entityFields, sessionId: uuidSchema, exerciseInstanceId: uuidSchema.optional(), kind: z.enum(['exercise', 'rest']), status: z.enum(['idle', 'running', 'paused', 'stopped']),
  accumulatedMs: nonnegative, startedAtMs: nonnegative.optional(), targetMs: positive.optional(),
});
const v8Minutes = z.number().int().min(10).max(120);
const v8AdjustmentMinutes = z.number().int().min(10).max(120);
/** Untargeted source courses retain real elapsed minutes; ordinary courses keep their existing bounds. */
export function validateTemplateMinutes(template:{estimatedMinutes:number;durationScope?:'untargeted';targetMinutes?:number},ctx:z.RefinementCtx){
 if(template.durationScope==='untargeted'&&template.targetMinutes===undefined)return;
 if(!v8AdjustmentMinutes.safeParse(template.estimatedMinutes).success)ctx.addIssue({code:'custom',path:['estimatedMinutes'],message:'Invalid estimated duration'});
}
const v8PreferredDays = z.array(z.enum(['mon','tue','wed','thu','fri','sat','sun'])).max(7).optional();
/** Optional weekly-budget layer (V9.14); absent on older versions means "by day" as before. */
export const weeklyBudgetSchema = z.strictObject({
  mode: z.enum(['by-day', 'budget']),
  minutesPerWeek: z.number().int().positive().max(7 * 24 * 60).optional(),
  setsPerGroupPerWeek: z.number().positive().max(100).optional(),
});
export const v8PlanVersionSchema = z.strictObject({
  enginePlan:enginePlanSchema.optional(),
  id: uuidSchema, planId: uuidSchema, versionNumber: positive, goalText: z.string(), weeklyTarget: positive.max(7),
  scheduleOriginalText: z.string(), sessionMinutes: v8Minutes,
  preferredDays: v8PreferredDays,
  /** Local calendar date the plan starts (V9.x); absent on older versions means it started when created. */
  startDate: localDateSchema.optional(),
  /** Calendar-picked training days (V9.x, Bo 2026-10-19): sorted, unique, 1–30, span ≤ 30 days; absent on older versions. */
  trainingDates: z.array(localDateSchema).min(1).max(30).optional(),
  /** Planned start time of day, local HH:MM; absent when not chosen. */
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  scheduleRecovery:z.strictObject({raw:z.string(),recoveredAt:utcTimestampSchema}).optional(),
  weeklyBudget: weeklyBudgetSchema.optional(),
  templates: z.array(z.strictObject({ weekday:z.enum(['mon','tue','wed','thu','fri','sat','sun']).optional(), id: z.string().min(1), name: z.string().min(1), estimatedMinutes: z.number().int().positive().max(120), estimatedSeconds:z.number().positive().optional(),durationScope:z.literal('untargeted').optional(),targetMinutes:z.number().int().min(10).max(90).optional(),
    items: z.array(z.strictObject({ exerciseId: exerciseIdSchema, equipment: z.string(), sets: positive, target: setMetricsSchema, prescription:prescriptionSchema.optional() })).min(1),
  }).superRefine(validateTemplateMinutes)).min(1), createdAt: utcTimestampSchema, origin: z.enum(['onboard', 'coach_change', 'review_suggestion', 'manual', 'migrated']),
  reviewRule: z.enum(['time','progression','frequency','restart','discomfort']).optional(),
  changeSummary: z.array(z.string()), basedOnVersionId: uuidSchema.optional(), source: z.enum(['local', 'ai']).optional(),
});
const v8NextWorkoutOverrideSchema = z.strictObject({ planVersionId: uuidSchema, templateId: z.string(), template: v8PlanVersionSchema.shape.templates.element, requestId: uuidSchema });
const v8PlanSchema = z.strictObject({ id: uuidSchema, name: z.string(), currentVersionId: uuidSchema, readOnly: z.boolean(), deletedAt: utcTimestampSchema.optional(), deletedWasCurrent: z.boolean().optional(), deletedNextWorkoutOverride: v8NextWorkoutOverrideSchema.optional() });
const v8Feel = z.enum(['easy', 'right', 'tired', 'very_tired']);
const v8Reason = z.enum(['time', 'fatigue', 'discomfort', 'equipment_busy', 'not_today', 'other']);
export const setFeedbackEventSchema=z.strictObject({id:uuidSchema,itemIndex:nonnegative,setIndex:nonnegative,exerciseId:exerciseIdSchema,createdAt:utcTimestampSchema,effort:z.enum(['too_light','right','too_hard','discomfort']),rir:z.number().min(0).max(10).optional(),painScore:z.number().int().min(0).max(10).optional(),painArea:cautionSchema.optional()}).superRefine((event,ctx)=>{if(event.effort==='discomfort'&&(event.painScore===undefined||!event.painArea))ctx.addIssue({code:'custom',message:'Discomfort requires an explicit score and area'});});
export const v8WorkoutSchema = z.strictObject({
  postpartumSymptoms:z.array(z.strictObject({recordedAt:utcTimestampSchema,urgent:z.array(z.enum(['heavy_bleeding','fever','wound_hot_red_or_oozing','calf_pain_or_swelling','chest_pain','breathlessness'])),regression:z.array(z.enum(['leakage','heaviness','dragging','pain','bleeding']))})).optional(),
  painActions:z.array(z.strictObject({eventId:uuidSchema,appliedAt:utcTimestampSchema,kind:z.enum(['substitute','exclude','review']),pattern:patternSchema,itemIndex:nonnegative,replacement:engineItemSchema.optional(),excludedItemIndexes:z.array(nonnegative).optional(),redFlagAnswers:z.record(z.string(),z.boolean()).optional()})).optional(),
  painReviewRequired:z.boolean().optional(),
  setFeedbackEvents:z.array(setFeedbackEventSchema).optional(),
  checkin:z.strictObject({energyMotivation:z.number().int().min(1).max(5).optional(),poorSleepNights:z.number().int().nonnegative().optional(),sorenessResolved:z.boolean().optional(),newOrWorseJointPain:z.boolean().optional()}).optional(),
  id: uuidSchema, planVersionId: uuidSchema.optional(), templateId: z.string().optional(), startedAt: utcTimestampSchema, endedAt: utcTimestampSchema.optional(),
  localDate: localDateSchema, timeZone: timeZoneSchema, status: z.enum(['in_progress', 'complete', 'partial', 'not_started', 'abandoned']), variant: z.literal('short').optional(),
  sets: z.array(z.strictObject({ exerciseId: exerciseIdSchema, itemIndex: nonnegative, setIndex: nonnegative, reps: positive.optional(), durationSeconds: positive.optional(),
    distanceMeters: nonnegative.optional(), loadGrams: nonnegative.nullable().optional(), completedAt: utcTimestampSchema, substitutedFrom: exerciseIdSchema.optional() })),
  plannedSetCount: nonnegative,
  templateSnapshot: v8PlanVersionSchema.shape.templates.element.optional(),
  feedback: z.strictObject({ feel: v8Feel.optional(), reasons: z.array(v8Reason), note: z.string().optional(), discomfortExerciseIds: z.array(exerciseIdSchema).optional() }).optional(),
  plannedExercises: z.array(z.strictObject({ exerciseId: exerciseIdSchema, itemIndex: nonnegative, plannedSetCount: nonnegative })).optional(),
  substitutions: z.array(z.strictObject({ fromExerciseId: exerciseIdSchema, toExerciseId: exerciseIdSchema, itemIndex: nonnegative, reason: z.enum(['discomfort', 'other']), createdAt: utcTimestampSchema })).optional(),
  appendedNotes: z.array(z.strictObject({ text: z.string(), createdAt: utcTimestampSchema })).optional(),
  timeCorrections: z.array(z.strictObject({ startedAt: utcTimestampSchema, endedAt: utcTimestampSchema, createdAt: utcTimestampSchema })).optional(),
}).superRefine((record,ctx)=>{
 const seen=new Set<string>();
 for(const [index,action] of (record.painActions??[]).entries()){
  if(action.kind==='review'&&(record.status==='in_progress'||action.replacement!==undefined||action.excludedItemIndexes!==undefined))ctx.addIssue({code:'custom',path:['painActions',index],message:'Historical review cannot execute or change an exercise'});
  if(action.kind==='exclude'&&(!action.excludedItemIndexes?.length||!action.excludedItemIndexes.includes(action.itemIndex)))ctx.addIssue({code:'custom',path:['painActions',index],message:'Pain exclusion must include the affected slot'});
  if(action.kind==='substitute'&&record.status==='in_progress'&&!action.replacement&&record.painReviewRequired!==true)ctx.addIssue({code:'custom',path:['painActions',index],message:'Missing replacement requires an explicit safety pause'});
  const event=record.setFeedbackEvents?.find(row=>row.id===action.eventId);
  if(seen.has(action.eventId)||!event||event.effort!=='discomfort'||event.itemIndex!==action.itemIndex||!record.sets.some(set=>set.itemIndex===event.itemIndex&&set.setIndex===event.setIndex&&set.exerciseId===event.exerciseId))ctx.addIssue({code:'custom',path:['painActions',index],message:'Pain action must reference one explicit completed-set discomfort event'});
  seen.add(action.eventId);
  if(action.excludedItemIndexes?.some(itemIndex=>!record.plannedExercises?.some(item=>item.itemIndex===itemIndex)))ctx.addIssue({code:'custom',path:['painActions',index,'excludedItemIndexes'],message:'Unknown pain exclusion slot'});
 }
});
export const v8ActivitySchema = z.strictObject({ id: uuidSchema, type: z.enum(['walk', 'run', 'cycle', 'swim', 'yoga', 'stairs', 'other']), customName: z.string().optional(),
  minutes: z.number().positive().finite(), localDate: localDateSchema, timeZone: timeZoneSchema, feel: v8Feel.optional(), note: z.string().optional(), createdAt: utcTimestampSchema });
export const v8CoachProfileSchema = z.strictObject({
  ...engineProfileSchema.pick({postpartumRisk:true,powerOneRm:true,householdSupport:true,goal:true,level:true,constraints:true,population:true,screening:true,preferences:true,birthYearMonth:true,equipmentLoadsKg:true,availableLoadsKg:true,painState:true}).partial().shape,
  healthStorageConsent:z.strictObject({acceptedAt:utcTimestampSchema}).optional(),
  goalText: z.string(), weeklyTarget: positive.max(7), sessionMinutes: v8Minutes, scheduleOriginalText: z.string(),
  preferredDays: v8PreferredDays,
  place: z.enum(['home', 'gym', 'outdoor', 'mixed']), equipment: z.array(z.string()), adultConfirmed: z.boolean(), placeEquipmentOriginalText: z.string().optional(),
  cautions: z.array(z.enum(['knee', 'back', 'shoulder', 'wrist', 'other'])), cautionNote: z.string().optional(), confirmedAt: utcTimestampSchema,
}).superRefine((profile,ctx)=>{if((profile.powerOneRm||profile.postpartumRisk)&&!profile.healthStorageConsent)ctx.addIssue({code:'custom',path:['powerOneRm'],message:'Health storage consent required for strength reference values'});});
export const v8StateSchema = z.strictObject({
  cautionLevels:z.partialRecord(z.enum(['knee','back','shoulder','wrist']),z.strictObject({level:z.union([z.literal(0),z.literal(1),z.literal(2)]),changedAt:utcTimestampSchema})).optional(),
  painFollowupRestrictions:z.array(z.strictObject({pattern:patternSchema,appliedAt:utcTimestampSchema,sourceWorkoutId:uuidSchema,cautionLevelDelta:z.number().int().nonnegative()})).optional(),
  postpartumReferralChecks:z.strictObject({each_phase_transition:z.strictObject({answeredAt:utcTimestampSchema,phase:z.union([z.literal(1),z.literal(2),z.literal(3)]).optional()}).optional(),running_readiness_check:z.strictObject({answeredAt:utcTimestampSchema}).optional(),weekly_checkin:z.strictObject({answeredAt:utcTimestampSchema}).optional()}).optional(),
  pregnancySafety:z.strictObject({providerPause:z.strictObject({requiredAt:utcTimestampSchema}).optional(),supineAvoidSince:utcTimestampSchema.optional()}).optional(),
  olderSafety:z.strictObject({fallAt:utcTimestampSchema,reviewRequiredAt:utcTimestampSchema.optional(),injuryConfirmed:z.literal(true).optional(),balanceStage:z.union([z.literal(1),z.literal(2),z.literal(3)]).optional(),professionalSeenAt:utcTimestampSchema.optional()}).optional(),
  cardiacPause:z.strictObject({requiredAt:utcTimestampSchema}).optional(),
  screeningEvidenceEvents:z.array(z.strictObject({answeredAt:utcTimestampSchema,symptoms:z.boolean()})).optional(),
  postpartumSafety:z.strictObject({lastSymptomAt:utcTimestampSchema.optional(),urgentAt:utcTimestampSchema.optional(),regression:z.strictObject({requiredAt:utcTimestampSchema,phase:z.union([z.literal(1),z.literal(2),z.literal(3)]),symptomFreeDates:z.array(localDateSchema)}).optional(),professionalSeenAt:utcTimestampSchema.optional()}).optional(),
  trainingPause:z.strictObject({requiredAt:utcTimestampSchema}).optional(),
  id: z.literal('v8'), currentPlanId: uuidSchema.optional(), planDismissedAt: utcTimestampSchema.optional(), reviewWeeklyTarget: positive.max(7).optional(), migratedAt: utcTimestampSchema,
  legacyPlanIds: z.array(uuidSchema),
  notice: z.strictObject({ planCount: nonnegative, currentPlanName: z.string().optional(), acknowledged: z.boolean() }),
  coachProfile: v8CoachProfileSchema.optional(),
  nextWorkoutOverride: v8NextWorkoutOverrideSchema.optional(),
  /** Home panel style (V9.14); absent means the default big-number panel. */
  homePanelStyle: z.enum(HOME_PANEL_STYLES).optional(),
});
const v8PlanReferenceSchema = z.strictObject({ id: uuidSchema, planId: uuidSchema, planName: z.string(), versionNumber: positive, templateIds: z.array(z.string()), legacyTemplates: z.array(v8PlanVersionSchema.shape.templates.element).optional() });
export const v8BackupSchema = z.strictObject({ state: v8StateSchema, plans: z.array(v8PlanSchema), planVersions: z.array(v8PlanVersionSchema),
  workouts: z.array(v8WorkoutSchema), activities: z.array(v8ActivitySchema), planReferences: z.array(v8PlanReferenceSchema).optional() });
// ---- Training-plan upgrade rows (UIUX20261008 V9.14, DB 21) ----
const fitnessTestValue = z.number().finite().nonnegative().max(10_000);
export const fitnessTestRecordSchema = z.strictObject({
  id: uuidSchema, localDate: localDateSchema, createdAt: utcTimestampSchema,
  results: z.partialRecord(z.enum(FITNESS_TEST_ITEMS), fitnessTestValue),
}).refine(record => Object.keys(record.results).length > 0, 'A fitness test needs at least one result');
const campSchema = z.strictObject({
  id: z.string().min(1).max(80), title: z.string().min(1).max(200),
  metric: z.enum([...FITNESS_TEST_ITEMS, 'weightKg', 'waistCm', 'sessions']),
  start: z.number().finite(), target: z.number().finite(), reachedAt: utcTimestampSchema.optional(),
});
export const journeySchema = z.strictObject({
  id: uuidSchema, route: z.enum(ROUTES), secondaryRoute: z.enum(ROUTES).optional(), destination: z.string().max(500),
  camps: z.array(campSchema).max(50), version: positive, createdAt: utcTimestampSchema,
}).superRefine((journey, ctx) => {
  if (new Set(journey.camps.map(camp => camp.id)).size !== journey.camps.length) ctx.addIssue({ code: 'custom', path: ['camps'], message: 'Camp IDs must be distinct' });
});
export const futureLetterSchema = z.strictObject({
  id: uuidSchema, text: z.string().min(1).max(5000), createdAt: utcTimestampSchema,
  openAtCampId: z.string().min(1).max(80).optional(), openedAt: utcTimestampSchema.optional(),
});
export const backupDataSchema = z.strictObject({
  fitnessTests: z.array(fitnessTestRecordSchema).optional(),
  journeys: z.array(journeySchema).optional(),
  futureLetters: z.array(futureLetterSchema).optional(),
  assistantConversations:z.array(conversationSchema).max(30).optional(),
  exerciseFavorites: z.array(z.strictObject({id:z.string().min(1)})).optional(),
  metadata: metadataSchema, profiles: z.array(localProfileSchema), plans: z.array(planSchema), planVersions: z.array(planVersionSchema),
  sessions: z.array(workoutSessionSchema), sets: z.array(setRecordSchema), scheduledWorkouts: z.array(legacyBackupScheduleSchema),
  bodyWeights: z.array(bodyWeightObservationSchema), trainingMemo: trainingMemoSchema, aiMemoryNotes: z.array(aiMemoryNoteSchema), timers: z.array(timerStateSchema),
  mediaAssets: z.array(mediaAssetSchema).default([]),
  guidedStates: z.array(guidedStateSchema).optional(),
  v8: v8BackupSchema.optional(),
  nutritionRecords: z.array(nutritionRecordSchema).optional(),
  activityImportReceipts: z.array(activityImportReceiptSchema).optional(),
});
export const backupEnvelopeSchema = z.strictObject({ format: z.literal('fitness-local'), schemaVersion: positive, exportedAt: utcTimestampSchema, catalogVersion: positive, data: backupDataSchema });
