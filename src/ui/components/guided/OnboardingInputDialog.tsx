import { useEffect, useRef, useState } from 'react';
import type { GuidedLocale } from './GuidedOnboarding';
import { NumericWheel } from './NumericWheel';
import { validNumber, type numbers } from './onboarding-content';

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start(): void; abort(): void; stop(): void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export function OnboardingInputDialog({ locale, title, initial, config, returnFocusTo, onClose, onApply }: {
  locale: GuidedLocale; title: string; initial: string | number;
  returnFocusTo: HTMLElement;
  config?: NonNullable<typeof numbers.age>; onClose(): void; onApply(value: string | number): void;
}) {
  const t = (zh: string, en: string) => locale === 'zh' ? zh : en;
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement>(returnFocusTo);
  const recognition = useRef<Recognition | null>(null);
  const [value, setValue] = useState(String(initial));
  const [listening, setListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const Speech = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
  const valid = config ? validNumber(value, config) : value.trim().length > 0 && value.length <= 2000;
  function abort() {
    const current = recognition.current; recognition.current = null;
    if (current) { current.onresult = null; current.onerror = null; current.onend = null; current.abort(); }
  }
  useEffect(() => {
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('.onboarding-direct input, textarea')?.focus();
    const update = () => { setOnline(navigator.onLine); if (!navigator.onLine) { abort(); setListening(false); } };
    window.addEventListener('online', update); window.addEventListener('offline', update);
    const currentDialog = dialog.current;
    return () => { abort(); window.removeEventListener('online', update); window.removeEventListener('offline', update); currentDialog?.close(); returnFocus.current?.focus(); };
  }, []);
  function startVoice() {
    if (!Speech || !online || listening) return;
    setVoiceError('');
    try {
      const current = new Speech(); recognition.current = current;
      current.lang = locale === 'zh' ? 'zh-CN' : 'en-US'; current.continuous = false; current.interimResults = false;
      current.onresult = event => {
        if (recognition.current !== current) return;
        const text = Array.from(event.results).filter(result => result.isFinal).map(result => result[0].transcript).join(' ');
        setValue(previous => [previous, text].filter(Boolean).join(' '));
      };
      current.onerror = () => { setVoiceError(t('语音暂不可用，请继续输入文字。', 'Voice is unavailable. You can keep typing.')); abort(); setListening(false); };
      current.onend = () => { if (recognition.current === current) { recognition.current = null; setListening(false); } };
      current.start(); setListening(true);
    } catch { abort(); setListening(false); setVoiceError(t('无法启动语音，请继续输入文字。', 'Could not start voice input. You can keep typing.')); }
  }
  return <dialog ref={dialog} className="onboarding-input-dialog" aria-labelledby="onboarding-input-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2 id="onboarding-input-title">{title}</h2><button type="button" onClick={onClose} aria-label={t('关闭', 'Close')}>×</button></header>
    {config ? <>
      <NumericWheel locale={locale} label={title} value={value === '' ? '' : Number(value)} {...config} onChange={next => setValue(String(next))} />
      <label className="onboarding-direct">{t('准确数值', 'Exact value')} {config.unit}<input autoFocus inputMode={config.unit ? 'decimal' : 'numeric'} type="number" min={config.min} max={config.max} step={config.unit ? 'any' : 1} value={value} placeholder={String(config.sample)} onChange={event => setValue(event.target.value)} /></label>
      <p className="onboarding-hint">{value === '' ? t('滚轮显示示例，选择或输入后再确认。', 'The wheel shows a sample. Choose or enter your value to confirm.') : !valid ? t(`请检查数值：${config.min}–${config.max}${config.unit ? '' : '，请输入整数'}。`, `Check the value: ${config.min}–${config.max}${config.unit ? '' : ', whole years only'}.`) : t('只用于当前资料，不创建测量历史。', 'For your profile only; no measurement history is created.')}</p>
    </> : <>
      <label>{t('用自己的话说', 'In your own words')}<textarea autoFocus rows={4} maxLength={2000} value={value} onChange={event => setValue(event.target.value)} /></label>
      <p className="onboarding-hint">{t('检查文字后确认，下一步再保存回答。', 'Review the text before confirming. Continue to save your answer.')}</p>
      {!voiceNotice ? <button type="button" onClick={() => setVoiceNotice(true)}>{t('语音转写', 'Voice input')}</button> : <div className="onboarding-voice">
        <p>{t('浏览器可能将语音发送给其识别服务。Fitness 不保存录音，只保留你确认的文字。', 'Your browser may send audio to its recognition service. Fitness keeps no recordings, only text you confirm.')}</p>
        {!Speech || !online ? <p role="status">{t('此浏览器或离线状态不支持语音，请输入文字。', 'Voice is unavailable in this browser or offline. Please type instead.')}</p> : <button type="button" onClick={listening ? () => recognition.current?.stop() : startVoice}>{listening ? t('停止转写', 'Stop listening') : t('同意并开始语音', 'Agree and start voice')}</button>}
        <span role="status">{listening ? t('正在聆听…', 'Listening…') : voiceError}</span>
      </div>}
    </>}
    <footer><button type="button" onClick={onClose}>{t('取消', 'Cancel')}</button><button type="button" className="guided-primary" disabled={!valid || listening} onClick={() => { onApply(config ? Number(value) : value.trim()); onClose(); }}>{t('确认选择', 'Confirm selection')}</button></footer>
  </dialog>;
}
