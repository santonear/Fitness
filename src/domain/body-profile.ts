import {z} from 'zod';
export const bodyFields=['biologicalSex','age','heightCm','weightKg','waistCm'] as const;
export type BodyField=typeof bodyFields[number];
export const bodyValuesSchema=z.strictObject({biologicalSex:z.enum(['女性','男性','不愿透露']).optional(),age:z.number().int().min(12).max(70).optional(),heightCm:z.number().int().min(100).max(230).optional(),weightKg:z.number().int().min(30).max(300).optional(),waistCm:z.number().int().min(40).max(200).optional()});
export type BodyValues=z.infer<typeof bodyValuesSchema>;
export const bodyDetailsSchema=z.strictObject({values:bodyValuesSchema,source:z.enum(['entered','migrated']),updatedAt:z.iso.datetime(),confirmedAt:z.iso.datetime().optional(),weightPromptAt:z.iso.datetime().optional()});
export type BodyDetails=z.infer<typeof bodyDetailsSchema>;
export const missingBodyFields=(values:BodyValues)=>bodyFields.filter(key=>key!=='waistCm'&&values[key]===undefined);
export const bodyComplete=(values:BodyValues)=>bodyValuesSchema.safeParse(values).success&&!missingBodyFields(values).length;
