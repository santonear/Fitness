import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';

export type MorphPanelProps = {
  open: boolean; onClose: () => void; triggerRef: RefObject<HTMLElement | null>;
  title: string; closeLabel?: string; children: ReactNode;
};

const frame = (element: HTMLElement): Keyframe => {
  const rect = element.getBoundingClientRect();
  return { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: getComputedStyle(element).borderRadius };
};

/** Native modal semantics keep background content inert and keyboard focus inside. */
export function MorphPanel({ open, onClose, triggerRef, title, closeLabel = '关闭', children }: MorphPanelProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const panel = dialog.current;
    if (!panel) return;
    let animation: Animation | undefined;
    let cancelled = false;
    const source = triggerRef.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => { if (!cancelled) { panel.close(); if (source?.isConnected) source.focus({ preventScroll: true }); } };
    if (open) {
      if (!panel.open) panel.showModal();
      const style = getComputedStyle(panel);
      const duration = reduced ? 120 : parseFloat(style.getPropertyValue('--morph-dur')) || 520;
      animation = panel.animate(reduced || !source ? [{ opacity: 0 }, { opacity: 1 }] : [frame(source), frame(panel)], {
        duration, easing: reduced ? 'linear' : style.getPropertyValue('--morph-ease').trim() || 'ease-out',
      });
    } else if (panel.open) {
      const frames = reduced || !source?.isConnected ? [{ opacity: 1 }, { opacity: 0 }] : [frame(panel), frame(source)];
      animation = panel.animate(frames, { duration: reduced ? 120 : 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      animation.onfinish = finish;
    }
    return () => { cancelled = true; animation?.cancel(); };
  }, [open, triggerRef]);
  useEffect(() => () => { if (dialog.current?.open) dialog.current.close(); if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true }); }, [triggerRef]);
  return <dialog ref={dialog} className="v8-morph" aria-labelledby={titleId} aria-modal="true"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    <div className="v8-morph-body" data-open={open}>
      <header className="v8-morph-header"><h2 id={titleId}>{title}</h2><button type="button" className="v8-control v8-icon-button v8-press" aria-label={closeLabel} onClick={onClose}>×</button></header>
      {children}
    </div>
  </dialog>;
}
