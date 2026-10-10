import { useEffect, useRef } from 'react';

export type ToastProps = { message: string | null; onDismiss: () => void; duration?: number };
export function Toast({ message, onDismiss, duration = 2400 }: ToastProps) {
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => dismiss.current(), duration);
    return () => window.clearTimeout(timer);
  }, [message, duration]);
  return <div className="v8-toast" role="status" aria-live="polite" aria-atomic="true" hidden={!message}>{message}</div>;
}
