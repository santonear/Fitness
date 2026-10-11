import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';

export type MorphPanelProps = {
  open: boolean; onClose: () => void; triggerRef: RefObject<HTMLElement | null>;
  title: string; closeLabel?: string; children: ReactNode;
  placement?: 'center' | 'bottom';
};

const frame = (element: HTMLElement): Keyframe => {
  const rect = element.getBoundingClientRect();
  return { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: getComputedStyle(element).borderRadius };
};

/** Native modal semantics keep background content inert and keyboard focus inside. */
export function MorphPanel({ open, onClose, triggerRef, title, closeLabel = '关闭', children, placement = 'center' }: MorphPanelProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const panel = dialog.current;
    if (!panel) return;
    let animation: Animation | undefined;
    let cancelled = false;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    if (open && !panel.open) opener.current = triggerRef.current;
    const source = opener.current;
    const originalVisibility = source?.style.visibility ?? '';
    const reveal = () => { if (source) source.style.visibility = originalVisibility; };
    if (source && (open || panel.open)) source.style.visibility = 'hidden';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => { if (!cancelled && !finished) { finished = true; clearTimeout(closeTimer); panel.close(); reveal(); if (source?.isConnected) source.focus({ preventScroll: true }); } };
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
      closeTimer = setTimeout(finish, 600);
    }
    return () => { cancelled = true; clearTimeout(closeTimer); animation?.cancel(); reveal(); };
  }, [open, triggerRef]);
  useEffect(() => {
    // WebKit can move focus to the document when the focused submit button becomes disabled.
    // Capture Tab at document level so this case is contained as well as ordinary wraparound.
    const containTab = (event: KeyboardEvent) => {
      const panel = dialog.current;
      if (event.key !== 'Tab' || !panel?.open) return;
      const controls = Array.from(panel.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]'))
        .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
      event.preventDefault();
      const index = controls.indexOf(document.activeElement as HTMLElement);
      const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      (controls[next] ?? panel).focus({ preventScroll: true });
    };
    document.addEventListener('keydown', containTab, true);
    return () => document.removeEventListener('keydown', containTab, true);
  }, []);
  useEffect(() => { const panel = dialog.current; return () => { if (panel?.open) panel.close(); if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); }; }, []);
  return <dialog ref={dialog} role="dialog" className="v8-morph" data-placement={placement} aria-labelledby={titleId} aria-modal="true"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    <div className="v8-morph-body" data-open={open}>
      <header className="v8-morph-header"><h2 id={titleId}>{title}</h2><button type="button" className="v8-control v8-icon-button v8-press" aria-label={closeLabel} onClick={onClose}>×</button></header>
      {children}
    </div>
  </dialog>;
}


