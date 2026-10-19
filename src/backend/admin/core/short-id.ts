/**
 * The one short-ID length shown anywhere in the admin console. Usage rows have
 * always stored 8 characters, so user lists, applications, invitations and
 * audit exports use the same length and an operator can match them by eye.
 */
export const SHORT_ID_LENGTH = 8;
export const shortId = (id: string) => id.slice(0, SHORT_ID_LENGTH);
