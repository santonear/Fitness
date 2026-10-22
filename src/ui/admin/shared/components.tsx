import { useTranslation } from 'react-i18next';
import { useEffect, useRef, type ReactNode } from 'react';
export function AdminDialog({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  cancelLabel,
  busy = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
}) {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith('zh');
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      opener.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      opener.current?.focus();
    }
    return () => {
      dialog.current?.close();
      opener.current?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="admin-dialog"
      aria-label={title}
      aria-modal="true"
      onCancel={e => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2>{title}</h2>
      {children}
      <div className="admin-actions">
        <button disabled={busy} onClick={onClose}>
          {cancelLabel ?? (zh ? '取消' : 'Cancel')}
        </button>
        {onConfirm && (
          <button disabled={busy} className="primary" onClick={onConfirm}>
            {confirmLabel ?? (zh ? '确认' : 'Confirm')}
          </button>
        )}
      </div>
    </dialog>
  );
}
export function AdminToast({ message }: { message: string }) {
  return message ? (
    <div className="admin-toast" role="status">
      {message}
    </div>
  ) : null;
}
