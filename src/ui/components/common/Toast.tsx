import { Button } from './index';
import { useEffect, useRef } from 'react';

export type ToastProps = {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
  action?: { label: string; onClick: () => void; disabled?: boolean };
};
export function Toast({ message, onDismiss, duration = 2400, action }: ToastProps) {
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => dismiss.current(), duration);
    return () => window.clearTimeout(timer);
  }, [message, duration]);
  return (
    <div className="v8-toast" role="status" aria-live="polite" aria-atomic="true" hidden={!message}>
      <span>{message}</span>
      {action && (
        <Button disabled={action.disabled} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
