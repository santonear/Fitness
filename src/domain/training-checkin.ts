import { z } from 'zod';
import {
  cautionSchema,
  engineCheckinSchema,
  painSideSchema,
  type CautionJoint,
  type EngineCheckin,
} from '../engine/contracts';

export const jointPainSchema = z.strictObject({
  painScore: z.number().int().min(0).max(10).optional(),
  painArea: cautionSchema.optional(),
  painSide: painSideSchema.optional(),
  redFlagAnswers: z.record(z.string(), z.boolean()).optional(),
});
export const trainingCheckinInputSchema = engineCheckinSchema.extend({
  painFollowup: z
    .strictObject({
      workoutId: z.uuid(),
      itemIndex: z.number().int().nonnegative(),
      painArea: cautionSchema,
    })
    .optional(),
  jointPain: jointPainSchema.optional(),
});
export type TrainingCheckinInput = z.infer<typeof trainingCheckinInputSchema>;

/** Ephemeral local health answers. Intentionally absent from the backup envelope. */
export interface TrainingCheckinRow {
  id: string;
  recordedAt: string;
  expiresAt: string;
  answers: EngineCheckin;
  cautionMorning?: {
    workoutId: string;
    joint: CautionJoint;
    painLastedToNextMorning: boolean;
  };
  painFollowup?: TrainingCheckinInput['painFollowup'];
  jointPain?: z.infer<typeof jointPainSchema>;
}
