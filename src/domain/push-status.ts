/**
 * Shared vocabulary for why background push is unavailable. The app's
 * /api/v1/push/config, the user settings page and the admin notification
 * card all report the same two reasons instead of an HTTP error.
 */
export type PushUnavailableReason = 'disabled' | 'unconfigured';
export interface PushConfigResponse {
  enabled: boolean;
  publicKey?: string;
  reason?: PushUnavailableReason;
}
export const pushStatusCopy = {
  zh: {
    disabled: '推送开关已关闭，暂时无法订阅和发送。',
    unconfigured: '推送服务尚未配置（缺少推送服务或密钥），暂时无法订阅和发送。',
  },
  en: {
    disabled: 'Push is turned off; subscribing and sending are unavailable.',
    unconfigured:
      'The push service is not configured (service or keys missing); subscribing and sending are unavailable.',
  },
} as const;
