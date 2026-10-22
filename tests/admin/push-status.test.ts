import { expect, it } from 'vitest';
import { appPushUnavailableReason, pushUnavailableReason } from '../../src/backend/admin/quality/notifications';
import { pushStatusCopy } from '../../src/domain/push-status';
it('admin notification card reports the same push reasons as the app config endpoint', async () => {
  expect(pushUnavailableReason({ ADMIN_PUSH_ENABLED: 'false' })).toBe('disabled');
  expect(pushUnavailableReason({ ADMIN_PUSH_ENABLED: 'true' })).toBe('unconfigured');
  expect(
    pushUnavailableReason({
      ADMIN_PUSH_ENABLED: 'true',
      VAPID_PRIVATE_JWK: '{}',
      VAPID_PUBLIC_KEY: 'k',
      VAPID_SUBJECT: 'mailto:a@b.c',
    }),
  ).toBeNull();
  expect(
    await appPushUnavailableReason({ FITNESS_FEATURE_FLAGS: JSON.stringify({ systemNotifications: true }) } as never),
  ).toBe('unconfigured');
  expect(
    await appPushUnavailableReason({
      PUSH: {},
      FITNESS_FEATURE_FLAGS: JSON.stringify({ systemNotifications: false }),
    } as never),
  ).toBe('disabled');
  expect(
    await appPushUnavailableReason({
      PUSH: {},
      FITNESS_FEATURE_FLAGS: JSON.stringify({ systemNotifications: true }),
    } as never),
  ).toBeNull();
  for (const language of ['zh', 'en'] as const)
    for (const reason of ['disabled', 'unconfigured'] as const)
      expect(pushStatusCopy[language][reason].length).toBeGreaterThan(5);
});
