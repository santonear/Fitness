const reasons: Record<string, [string, string]> = {
  access_protected: ['登录保护已生效', 'Login protection is active'],
  access_login_required: [
    '需要登录才能打开；检查时未登录，页面内容尚未确认',
    'Login is required; the check was not signed in, so page content is unconfirmed',
  ],
  anonymous_denied: ['未登录请求已被拒绝', 'Anonymous request was denied'],
  anonymous_access_allowed: [
    '未登录请求意外获得访问，需要检查保护设置',
    'Anonymous access unexpectedly allowed; check protection',
  ],
  unexpected_response: ['入口返回非预期响应', 'Entry returned an unexpected response'],
  unexpected_redirect: ['跳转到了无法确认的登录页面', 'Redirected to an unrecognized login page'],
  http_error: ['服务返回错误响应', 'Service returned an error'],
  invalid_features: ['功能配置返回的内容无法识别', 'Feature response is invalid'],
  content_available: ['内容检查通过', 'Content check passed'],
  transport_unavailable: [
    '检查时连接失败或超时，服务状态尚未确认',
    'Probe connection failed or timed out; service state is unverified',
  ],
};
export function smokeReason(reason: string | null | undefined, zh: boolean) {
  return (
    reasons[reason ?? '']?.[zh ? 0 : 1] ??
    (zh ? '这次检查没有记录原因，请重新检查' : 'Legacy check has no reason; rerun checks')
  );
}
