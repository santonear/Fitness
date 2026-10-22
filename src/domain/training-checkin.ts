import {z} from 'zod';
import {engineCheckinSchema,type EngineCheckin} from '../engine/contracts';

export const jointPainSchema=z.strictObject({painScore:z.number().int().min(0).max(10).optional(),painArea:z.enum(['knee','back','shoulder','wrist','other']).optional(),redFlagAnswers:z.record(z.string(),z.boolean()).optional()});
export const trainingCheckinInputSchema=engineCheckinSchema.extend({painFollowup:z.strictObject({workoutId:z.uuid(),itemIndex:z.number().int().nonnegative(),painArea:z.enum(['knee','back','shoulder','wrist','other'])}).optional(),jointPain:jointPainSchema.optional()});
export type TrainingCheckinInput=z.infer<typeof trainingCheckinInputSchema>;

/** Ephemeral local health answers. Intentionally absent from the backup envelope. */
export interface TrainingCheckinRow {id:string;recordedAt:string;expiresAt:string;answers:EngineCheckin;cautionMorning?:{workoutId:string;joint:'knee'|'back'|'shoulder'|'wrist';painLastedToNextMorning:boolean};painFollowup?:TrainingCheckinInput['painFollowup'];jointPain?:z.infer<typeof jointPainSchema>}
