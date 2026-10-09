import { CoachNudge } from './CoachNudge';
import { coachReminderService } from '../../application/coach-reminders';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GuidedDialoguePage } from '../pages/GuidedDialoguePage';
import { CoachAvatar, type CoachVisualState } from './CoachAvatar';
import '../coach.css';
import { guidedService } from '../../application/guided';

const preferenceKey = 'fitness-coach-dock-v62';
export const openCoachEvent = 'fitness:open-coach';
export function CoachRoute() {
  const { i18n } = useTranslation();
  return <section><h1>AI Coach</h1><button onClick={() => window.dispatchEvent(new Event(openCoachEvent))}>{i18n.resolvedLanguage === 'zh' ? '打开芽芽对话' : 'Open coach conversation'}</button></section>;
}

export function FloatingCoach() {
  const { i18n } = useTranslation(); const zh = i18n.resolvedLanguage === 'zh';
  const location = useLocation();
  const navigate = useNavigate();
  const [entryError, setEntryError] = useState('');
  const [open, setOpen] = useState(false); const [mounted, setMounted] = useState(false);
  const [visual, setVisual] = useState<CoachVisualState>('idle');
  const [mobile, setMobile] = useState(() => matchMedia('(max-width:767px)').matches);
  const [dock, setDock] = useState<{ side: 'left' | 'right'; collapsed: boolean }>(() => {
    try { const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? '{}'); return { side: saved.side === 'left' ? 'left' : 'right', collapsed: saved.collapsed === true }; }
    catch { return { side: 'right', collapsed: false }; }
  });
  const launcher = useRef<HTMLButtonElement>(null); const panel = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const entrySequence = useRef(0);
  const hidden = location.pathname === '/onboarding';
  const show = useCallback(() => {
    const sequence = ++entrySequence.current;
    returnFocus.current = document.activeElement instanceof HTMLElement && document.activeElement.matches('button,a[href],input,textarea,select') ? document.activeElement : null;
    void guidedService.onboardingEntry().then(entry => {
      if (sequence !== entrySequence.current) return;
      if (entry.required || entry.state.onboarding?.version === 4 && !entry.state.onboarding.completed) { navigate('/onboarding'); return; }
      setEntryError(''); setMounted(true); setOpen(true);
    }).catch(error => { if (sequence === entrySequence.current) setEntryError(String(error)); });
  }, [navigate]);
  const close = useCallback(() => { entrySequence.current++; setOpen(false); requestAnimationFrame(() => { const target = returnFocus.current; (target?.isConnected && target.getClientRects().length ? target : launcher.current)?.focus({ preventScroll: true }); }); }, []);
  useEffect(() => { try { localStorage.setItem(preferenceKey, JSON.stringify(dock)); } catch { /* Session-only docking remains usable. */ } }, [dock]);
  useEffect(() => {
    if (location.pathname === '/ai') show(); else setOpen(false);
    return () => { entrySequence.current++; };
  }, [location.pathname, show]);
  useEffect(() => { window.addEventListener(openCoachEvent, show); return () => window.removeEventListener(openCoachEvent, show); }, [show]);
  useEffect(() => { const query = matchMedia('(max-width:767px)'); const change = () => setMobile(query.matches); query.addEventListener('change', change); return () => query.removeEventListener('change', change); }, []);
  useEffect(() => { if (visual !== 'success' && visual !== 'replying') return; const timeout = setTimeout(() => setVisual('idle'), 3500); return () => clearTimeout(timeout); }, [visual]);
  useEffect(() => {
    if (!open || !mobile || hidden) return;
    const siblings = Array.from(panel.current?.closest('.coach-root')?.parentElement?.children ?? []).filter((node): node is HTMLElement => node instanceof HTMLElement && !node.classList.contains('coach-root'));
    const previous = siblings.map(node => node.inert); siblings.forEach(node => { node.inert = true; });
    return () => siblings.forEach((node, index) => { node.inert = previous[index]; });
  }, [open, mobile, hidden]);
  useEffect(() => {
    if (!open || hidden) return;
    panel.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { event.preventDefault(); close(); }
      if (mobile && event.key === 'Tab') {
        const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]') ?? []).filter(node => node.getClientRects().length > 0);
        const first = targets[0], last = targets.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
  }, [open, hidden, close, mobile]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => { panel.current?.style.setProperty('--coach-viewport-height', `${viewport?.height ?? innerHeight}px`); panel.current?.style.setProperty('--coach-viewport-top', `${viewport?.offsetTop ?? 0}px`); };
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize);
    return () => { viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); };
  }, []);
  const stateText = (zh ? { idle: '芽芽在这里', thinking: '正在等待 AI 回复', replying: '已收到 AI 回复，等待你审阅', success: '计划已保存' } : { idle: 'Your coach is here', thinking: 'Waiting for AI', replying: 'AI reply ready for review', success: 'Plan saved' })[visual];
  useEffect(() => { const sync = () => { void coachReminderService.preferences().then(v => setDock(d => ({...d,side:v.preferences.side}))).catch(() => {}); }; window.addEventListener('fitness:coach-preferences',sync); return () => window.removeEventListener('fitness:coach-preferences',sync); }, []);
  return <div className="coach-root" data-side={dock.side} hidden={hidden}>
    <CoachNudge chatOpen={open || hidden} onOpen={show}/>
    {entryError && <p className="coach-entry-error" role="alert">{entryError}</p>}
    <div className="coach-launcher" hidden={open} data-collapsed={dock.collapsed}>
      <button ref={launcher} className="coach-open" aria-label={zh ? '打开芽芽 AI 对话' : 'Open AI coach'} aria-expanded={open} aria-controls="fitness-coach-drawer" onClick={show}>
        {dock.collapsed ? <span>AI</span> : <CoachAvatar state={visual}/>}<span className="coach-accessible">{stateText}</span>
      </button>
      {!dock.collapsed && <button className="coach-collapse" aria-label={zh ? '收起到侧边' : 'Dock to edge'} onClick={() => setDock(value => ({ ...value, collapsed: true }))}>›</button>}
    </div>
    <div className="coach-scrim" hidden={!open} onClick={close}/>
    <div id="fitness-coach-drawer" className="coach-drawer" role="dialog" aria-modal={mobile} aria-label={zh ? '芽芽 AI 对话' : 'AI coach conversation'} tabIndex={-1} ref={panel} hidden={!open}>
      <header className="coach-toolbar"><span className="coach-toolbar-avatar"><CoachAvatar state={visual}/></span><div><strong>Fitness AI Coach</strong><small>{zh ? '芽芽 · ' : 'Coach · '}{stateText}</small></div><button aria-label={zh ? '切换停靠方向' : 'Switch dock side'} onClick={() => { const side=dock.side==='left'?'right':'left'; setDock(value=>({...value,side})); void coachReminderService.preferences().then(v=>coachReminderService.preferences({...v.preferences,side})).then(()=>window.dispatchEvent(new Event('fitness:coach-preferences'))).catch(()=>{}); }}>⇄</button><button aria-label={zh ? '展开悬浮头像' : 'Expand coach avatar'} onClick={() => setDock(value => ({...value,collapsed:false}))}>↗</button><button aria-label={zh ? '收起 AI 聊天' : 'Close coach conversation'} onClick={close}>×</button></header>
      <div className="coach-scroll">{mounted && <GuidedDialoguePage onCoachState={setVisual}/>}</div><div id="coach-send-host" className="coach-send-host"/>
    </div>
  </div>;
}
