import { z } from 'zod';
import { coachRequestSchema, type CoachRequest } from './contracts';
import { adaptCoachResponse } from './response-adapter';

export const coachWireVersions = ['8.1', '8.0'] as const;
const version = z.enum(coachWireVersions);
const requestEnvelope = z.strictObject({ schemaVersion: version, payload: coachRequestSchema });
const responseEnvelope = z.strictObject({ schemaVersion: version, payload: z.unknown() });

/** Both envelope revisions preserve the existing V8 payload semantics. */
export function readCoachRequestEnvelope(raw: unknown): CoachRequest {
  return requestEnvelope.parse(raw).payload;
}
export function writeCoachRequestEnvelope(request: CoachRequest, schemaVersion: typeof coachWireVersions[number] = '8.1') {
  return requestEnvelope.parse({ schemaVersion, payload: request });
}
export function readCoachResponseEnvelope(request: CoachRequest, raw: unknown) {
  const envelope = responseEnvelope.parse(raw);
  return adaptCoachResponse(request, envelope.payload);
}
