import { useCallback, useEffect, useState } from 'react';
import { readAccessStatus, type AccessStatus } from '../application/ai-access';
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
    if (enabled) void refresh();
  }, [enabled, refresh]);
  return { status, loading, failed, refresh };
}
