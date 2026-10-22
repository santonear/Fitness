import { z } from 'zod';

export const patternSchema = z.enum([
  'squat',
  'lunge',
  'hinge',
  'push_horizontal',
  'push_vertical',
  'pull_horizontal',
  'pull_vertical',
  'anti_extension',
  'anti_rotation',
  'anti_lateral_flexion',
  'trunk_flexion',
  'rotation',
  'carry',
  'locomotion_ground',
  'jump_land',
  'throw_upper',
  'olympic',
  'cardio_cyclic',
  'mobility',
  'balance',
  'isolation_upper',
  'isolation_lower',
]);
export type Pattern = z.infer<typeof patternSchema>;
export const cautionSchema = z.enum(['knee', 'back', 'shoulder', 'wrist', 'other']);
export type Caution = z.infer<typeof cautionSchema>;
export const weekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Weekday = z.infer<typeof weekdaySchema>;
export const equipmentItemSchema = z.enum([
  'none',
  'dumbbell',
  'barbell',
  'kettlebell',
  'resistance-band',
  'loop-band',
  'flat-bench',
  'adjustable-bench',
  'anchor-point',
  'pull-up-bar',
  'squat-rack',
  'box-or-step',
  'wall',
  'chair',
  'counter',
  'table',
  'towel',
  'backpack',
  'water-bottles',
  'pushup-handles',
  'back-extension-machine',
  'parallettes',
  'vertical-pole',
  'door-anchor',
  'wedge',
  'partner',
  'trap-bar',
  'beam',
  'landmine-attachment',
  'room-corner',
  'bench-with-uprights',
  'captains-chair',
  'slam-ball',
  'post',
  'heavy-kettlebell',
  'wrist-roller (stick + cord)',
  'rail',
  'yoga-mat',
  'yoga-mat-optional',
  'ab-wheel',
  'air-bike',
  'battle-rope',
  'cable',
  'calf-machine',
  'chest-press-machine',
  'dip-station',
  'elliptical',
  'ez-bar',
  'hack-squat',
  'jump-rope',
  'lat-pulldown-machine',
  'leg-curl',
  'leg-extension',
  'leg-press',
  'medicine-ball',
  'other-machine',
  'plates',
  'rings',
  'rope',
  'rowing-machine',
  'shoulder-press-machine',
  'ski-erg',
  'sled',
  'smith-machine',
  'stability-ball',
  'stair-climber',
  'stationary-bike',
  'suspension-trainer',
  'treadmill',
]);
export type EquipmentItem = z.infer<typeof equipmentItemSchema>;
export const nonnegative = z.number().finite().nonnegative();
export const populationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('general') }),
  z.strictObject({
    kind: z.literal('older_adult'),
    balanceCautious: z.boolean().optional(),
    walkingAid: z.boolean().optional(),
    fallsAnswers: z.array(z.boolean()).optional(),
    boneFlag: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal('pregnant'),
    week: nonnegative,
    providerCleared: z.boolean(),
    prenatalCareConfirmed: z.boolean().optional(),
    inactiveRampStartedAt: z.iso.datetime().optional(),
    contraindicationsConfirmedNone: z.boolean(),
    absoluteContraindications: z.array(z.string()).optional(),
    relativeContraindications: z.array(z.string()).optional(),
    lastScreenedWeek: nonnegative.optional(),
  }),
  z.strictObject({
    kind: z.literal('postpartum'),
    weeksSinceBirth: nonnegative,
    delivery: z.enum(['vaginal', 'assisted_or_tear', 'cesarean']),
    cleared: z.boolean(),
    readinessChecklistPassed: z.boolean().optional(),
    perinealTrauma: z.boolean().optional(),
    postnatalCheckDone: z.boolean().optional(),
  }),
]);
export const screeningSchema = z.strictObject({
  parqAllNo: z.boolean(),
  knownCondition: z.boolean(),
  symptoms: z.boolean(),
  cmrSymptoms: z.record(z.string(), z.boolean()).optional(),
  lastScreenedAt: z.string().optional(),
  completedAt: z.string().optional(),
  parqAnswers: z.array(z.boolean()).length(7).optional(),
  activityStatus: z.enum(['active', 'inactive']).optional(),
  knownCmrDisease: z.boolean().optional(),
  acuteIllness: z.boolean().optional(),
  restingBp: z.enum(['known_below_threshold', 'ge_160_90', 'unknown']).optional(),
  clearance: z
    .strictObject({
      date: z.string(),
      intensity: z.enum(['light_moderate', 'moderate', 'vigorous']),
    })
    .optional(),
  rescreenRequired: z.boolean().optional(),
  rarelyVigorous: z.boolean().optional(),
  age45AdvisoryAck: z
    .strictObject({
      acknowledgedAt: z.iso.datetime(),
      screenedAt: z.iso.datetime(),
    })
    .optional(),
  activityEvidence: z
    .strictObject({
      consecutiveRegularWeeks: z.number().int().nonnegative(),
      noSymptomReportsWeeks: z.number().int().nonnegative(),
    })
    .optional(),
  redFlagReview: z
    .strictObject({
      requiredAt: z.iso.datetime(),
      questionKeys: z.array(z.string()).min(1),
      areas: z.array(cautionSchema).min(1),
      answeredAt: z.iso.datetime().optional(),
      answers: z.record(z.string(), z.boolean()).optional(),
      professionalSeenAt: z.iso.datetime().optional(),
    })
    .optional(),
});
export const enginePreferencesSchema = z.strictObject({
  excludedExerciseIds: z.array(z.string()),
  cannotDo: z.array(z.enum(['walking_carry', 'jumping', 'floor_work', 'overhead', 'kneeling'])),
  liked: z.array(z.string()).optional(),
});
export const engineProfileSchema = z.strictObject({
  cautionLevels: z
    .partialRecord(z.enum(['knee', 'back', 'shoulder', 'wrist']), z.union([z.literal(0), z.literal(1), z.literal(2)]))
    .optional(),
  postpartumRisk: z
    .strictObject({
      under_3_months_postpartum: z.boolean().optional(),
      caesarean_or_perineal_trauma: z.boolean().optional(),
      breastfeeding: z.boolean().optional(),
      bmi_over_30: z.boolean().optional(),
      poor_sleep: z.boolean().optional(),
      hypermobility: z.boolean().optional(),
      preexisting_pelvic_floor_or_lumbopelvic_problem: z.boolean().optional(),
      low_energy_availability: z.boolean().optional(),
      psychological_drive_to_overexercise: z.boolean().optional(),
    })
    .optional(),
  olderSafety: z
    .strictObject({
      fallPaused: z.boolean().optional(),
      balanceStage: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    })
    .optional(),
  pregnancySafety: z.strictObject({ avoidSupine: z.boolean().optional() }).optional(),
  postpartumSafety: z
    .strictObject({
      urgentPaused: z.boolean().optional(),
      regressedPhase: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    })
    .optional(),
  powerOneRm: z
    .record(
      z.string(),
      z.strictObject({
        kg: z.number().positive(),
        source: z.enum(['user_record', 'reliable_estimate']),
      }),
    )
    .optional(),
  householdSupport: z.boolean().optional(),
  goal: z.enum(['health', 'fat_loss', 'strength', 'muscle', 'mobility', 'start_moving']),
  level: z.enum(['beginner', 'intermediate']),
  trainingAgeWeeks: nonnegative,
  daysPerWeek: z.number().int().min(1).max(6),
  preferredDays: z.array(weekdaySchema).max(6).optional(),
  sessionMinutes: z.number().int().min(10).max(90),
  equipment: z.array(equipmentItemSchema),
  place: z.enum(['home', 'gym', 'outdoor', 'mixed']),
  constraints: z.strictObject({
    noJump: z.boolean(),
    quiet: z.boolean(),
    space: z.enum(['mat', 'small', 'medium', 'large']),
  }),
  cautions: z.array(cautionSchema),
  population: populationSchema,
  screening: screeningSchema,
  preferences: enginePreferencesSchema,
  bodyWeightKg: z.number().positive().optional(),
  ageYears: nonnegative.optional(),
  birthYearMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  asOfDate: z.iso.date().optional(),
  timeZone: z
    .string()
    .refine(value => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    })
    .optional(),
  locale: z.enum(['zh', 'en']).optional(),
  equipmentLoadsKg: z.record(z.string(), z.number().positive()).optional(),
  availableLoadsKg: z.record(z.string(), z.array(z.number().positive()).min(1)).optional(),
  painState: z
    .array(
      z.strictObject({
        pattern: patternSchema,
        remainingSessions: nonnegative,
        cautionLevelDelta: z.number().int().nonnegative().optional(),
        repeatEvents: nonnegative.optional(),
        score: z.number().min(0).max(10).optional(),
      }),
    )
    .optional(),
});
export type EngineProfile = z.infer<typeof engineProfileSchema>;
