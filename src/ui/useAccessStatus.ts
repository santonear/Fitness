import { useCallback, useEffect, useState } from 'react';
import { readAccessStatus, type AccessStatus } from '../application/ai-access';
/** Fired after AI is turned on in the activation sheet, so every open status refreshes. */
export const ACCESS_CHANGED = 'fitness-access-changed';
export function useAccessStatus(enabled = true) {
  const [status, setStatus] = useState<AccessStatus>(),
    [loading, setLoading] = useState(false),
    [failed, setFailed] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setStatus(await readAccessStatus());
    } catch {
      setStatus(undefined);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const changed = () => void refresh();
    window.addEventListener(ACCESS_CHANGED, changed);
    return () => window.removeEventListener(ACCESS_CHANGED, changed);
  }, [enabled, refresh]);
  return { status, loading, failed, refresh };
}
