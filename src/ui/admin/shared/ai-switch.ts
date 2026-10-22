import { useCallback, useEffect, useState } from 'react';
import { adminRequest } from './api';

export interface AiStatusResponse {
  aiEnabled: boolean;
  aiFlag?: boolean;
  aiModelConnected?: boolean;
  aiEffective?: boolean;
}
export type AiOffReason = 'service' | 'flag' | 'model';
export interface AiSwitchState {
  effective: boolean;
  service: boolean;
  flag: boolean;
  offReason?: AiOffReason;
}
/**
 * Every admin view reads this one projection of `users/status`, so the todo
 * page and the settings page can never disagree about whether AI is on.
 */
export function aiSwitchState(status: AiStatusResponse): AiSwitchState {
  const flag = status.aiFlag ?? true,
    model = status.aiModelConnected ?? true,
    effective = status.aiEffective ?? (status.aiEnabled && flag && model);
  const offReason: AiOffReason | undefined = effective
    ? undefined
    : !status.aiEnabled
      ? 'service'
      : !flag
        ? 'flag'
        : !model
          ? 'model'
          : undefined;
  return { effective, service: status.aiEnabled, flag, ...(offReason ? { offReason } : {}) };
}
export function aiSwitchLabel(state: AiSwitchState | undefined, zh: boolean) {
  if (!state) return zh ? '状态不可用' : 'Unavailable';
  if (state.effective) return zh ? '开启' : 'On';
  const reason =
    state.offReason === 'flag'
      ? zh
        ? '对话开关已关闭'
        : 'assistant flag is off'
      : state.offReason === 'model'
        ? zh
          ? '模型未接入'
          : 'model is not connected'
        : zh
          ? 'AI 服务已关闭'
          : 'AI service is off';
  return zh ? `关闭（${reason}）` : `Off (${reason})`;
}
export function useAiSwitch() {
  const [state, setState] = useState<AiSwitchState>(),
    [failed, setFailed] = useState(false);
  const reload = useCallback(async () => {
    try {
      setState(aiSwitchState(await adminRequest<AiStatusResponse>('users/status')));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { state, failed, reload };
}
