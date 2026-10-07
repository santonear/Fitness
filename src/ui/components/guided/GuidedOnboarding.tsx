import { useEffect, useRef, useState } from 'react';
import '../../guided.css';
import { QuestionIllustration } from './QuestionIllustration';
import { OnboardingInputDialog } from './OnboardingInputDialog';
import { numbers, prompts, choices, categories, durationChoices, avoidChoices, valuesOf, translatedValue, validNumber } from './onboarding-content';
export { adjustGuidedNumber } from './NumericWheel';

export type GuidedLocale = 'zh' | 'en';
export type GuidedAnswer = { status: 'answered'; value: string | number | string[] } | { status: 'skipped' };
// Existing identifiers remain stable for previously saved onboarding progress.
export const guidedSteps = ['age', 'heightCm', 'weightKg', 'waistCm', 'bodyFatPercent', 'goal', 'experience', 'location', 'equipment', 'time', 'preferences', 'safety', 'biologicalSex'] as const;
export type GuidedQuestion = typeof guidedSteps[number];
export type GuidedAnswers = Partial<Record<GuidedQuestion, GuidedAnswer>>;
export interface GuidedOnboardingProps {
  locale: GuidedLocale; answers: GuidedAnswers; step: number;
  onAnswer(key: GuidedQuestion, answer: GuidedAnswer): void | Promise<void>;
  onStepChange(step: number): void; onComplete(): void; onReset(): void;
  busy?: boolean; error?: string;
}
const order = [0, 16, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 10, 14, 11, 15, 12];
const isDuration = (value: string) => durationChoices.some(item => item[0] === value) || value.startsWith('单次时长：');
const isAvoidance = (value: string) => value.startsWith('避免：') || value === '没有特别想避开的运动';

export function GuidedOnboarding({ locale, answers, step, onAnswer, onStepChange, onComplete, onReset, busy = false, error }: GuidedOnboardingProps) {
  const en = locale === 'en'; const t = (zh: string, english: string) => en ? english : zh;
  const current = order.includes(step) ? step : 0;
  const summary = current === 12; const duration = current === 13; const avoidance = current === 14; const safetyDetails = current === 15;
  const key: GuidedQuestion = current === 16 ? 'biologicalSex' : duration ? 'time' : avoidance ? 'preferences' : safetyDetails || summary ? 'safety' : guidedSteps[current];
  const answer = answers[key]; const config = numbers[key];
  const answerSignature = JSON.stringify(answer);
  const [selected, setSelected] = useState<string[]>([]);
  const [numeric, setNumeric] = useState<string | number>('');
  const [modal, setModal] = useState<{ initial: string | number; custom?: string; trigger: HTMLElement }>();
  const [reset, setReset] = useState(false);
  const [saving, setSaving] = useState(false); const savingRef = useRef(false);
  const [localError, setLocalError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null); const resetDialog = useRef<HTMLDialogElement>(null);
  const locked = busy || saving;
  const options = duration ? durationChoices : avoidance ? avoidChoices : safetyDetails ? [] : choices[key] ?? [];
  const multiple = ['goal', 'equipment', 'preferences'].includes(key);
  const title = summary ? t('这些，是你的出发点。', 'Your starting point.') : duration ? t('每次大概能留出多久？', 'How long feels workable?') : avoidance ? t('有哪些运动想先避开？', 'Anything you would rather avoid?') : safetyDetails ? t('训练时，需要注意什么？', 'What should training take into account?') : prompts[key][en ? 1 : 0];
  const categoryIndex = categories.findIndex(category => category.keys.includes(key));
  const category = categories[categoryIndex];
  const localTotal = key === 'time' || key === 'preferences' ? 2 : key === 'safety' && (safetyDetails || selected[0] === '有，需要说明') ? 2 : category.keys.length;
  const localIndex = duration || avoidance || safetyDetails ? 2 : category.keys.indexOf(key) + 1;
  const support = key === 'biologicalSex' ? t('请选择一项，也可以选择不愿透露。不会据此推断你的健康、孕期或训练能力。', 'Choose one, including prefer not to say. This does not determine your health, pregnancy status or training ability.') : config ? key === 'waistCm' || key === 'bodyFatPercent' ? t('知道的话可以填。测量仅作参考，也可以跳过。', 'Add it if you know it. A reference only; skipping is fine.') : t('选择准确数值；暂时不想提供，也可以跳过。', 'Choose an exact value, or skip for now.') : key === 'goal' ? t('可以多选。稍后再和 AI 一起确认你的目标。', 'Choose all that fit. Review your goal with AI later.') : key === 'safety' ? t('只说明影响训练的限制。跳过表示尚不了解。', 'Share only what affects training. Skipping leaves this unknown.') : key === 'time' ? t('先了解日常节奏，具体日期稍后一起安排。', 'Start with your usual rhythm. Choose exact dates later.') : t('选适合你的，也可以用自己的话补充。', 'Choose what fits, or tell us in your own words.');
  useEffect(() => {
    const values = valuesOf(answer);
    setNumeric(answer?.status === 'answered' && typeof answer.value === 'number' ? answer.value : '');
    if (key === 'time') setSelected(values.filter(value => duration ? isDuration(value) : !isDuration(value)));
    else if (key === 'preferences') setSelected(values.filter(value => avoidance ? isAvoidance(value) : !isAvoidance(value)));
    else if (key === 'safety') setSelected(safetyDetails ? values.filter(value => value.startsWith('有，需要说明：')).map(value => value.slice(7)) : values.map(value => value.startsWith('有，需要说明') ? '有，需要说明' : value));
    else if (key === 'equipment' && values.length === 1) setSelected(values[0].split('、').filter(Boolean));
    else setSelected(values);
    setLocalError(''); setModal(undefined); heading.current?.focus({ preventScroll: true });
  }, [current, key, answerSignature, duration, avoidance, safetyDetails]);
  useEffect(() => {
    if (reset && !resetDialog.current?.open) resetDialog.current?.showModal();
    if (!reset) resetDialog.current?.close();
  }, [reset]);
  function next() {
    if (current === 11 && selected[0] !== '有，需要说明') onStepChange(12);
    else onStepChange(order[order.indexOf(current) + 1] ?? 12);
  }
  function back() {
    const previous = order[order.indexOf(current) - 1] ?? 0;
    onStepChange(previous === 15 && !valuesOf(answers.safety).some(value => value.startsWith('有，需要说明')) ? 11 : previous);
  }
  async function save(skip: boolean) {
    if (locked || savingRef.current || key === 'biologicalSex' && skip) return;
    savingRef.current = true; setSaving(true); setLocalError('');
    let value: string | number | string[] = config ? Number(numeric) : selected;
    if (key === 'time' || key === 'preferences') {
      const belongs = key === 'time' ? isDuration : isAvoidance;
      const second = duration || avoidance;
      const other = valuesOf(answer).filter(item => second ? !belongs(item) : belongs(item));
      value = [...other, ...(skip ? [] : selected)];
    } else if (key === 'safety') {
      value = safetyDetails ? (skip ? '有，需要说明' : `有，需要说明：${selected.join('；')}`) : selected[0] ?? '';
      if (!safetyDetails && !skip && selected[0] === '有，需要说明') value = valuesOf(answer).find(item => item.startsWith('有，需要说明：')) ?? value;
    } else if (!multiple && !config) value = selected[0] ?? '';
    const partial = key === 'time' || key === 'preferences' || safetyDetails;
    const empty = Array.isArray(value) && value.length === 0;
    const response: GuidedAnswer = skip && !partial || empty ? { status: 'skipped' } : { status: 'answered', value };
    try { await onAnswer(key, response); if (current === 11 && skip) onStepChange(12); else next(); }
    catch { setLocalError(t('未能保存，回答仍在这里，请重试。', 'Could not save. Your answer is still here; please retry.')); }
    finally { savingRef.current = false; setSaving(false); }
  }
  function toggle(value: string) {
    const none = key === 'equipment' ? '徒手' : avoidance ? '没有特别想避开的运动' : '没有特别偏好';
    if (!multiple) setSelected([value]);
    else setSelected(previous => previous.includes(value) ? previous.filter(item => item !== value) : value === none ? [value] : [...previous.filter(item => item !== none), value]);
  }
  const valid = config ? validNumber(numeric, config) : selected.some(value => value.trim().length > 0);
  const customValues = selected.filter(value => !options.some(option => option[0] === value));
  const answered = Object.entries(answers).filter(([, value]) => value?.status === 'answered');
  return <section className={`guided-panel guided-onboarding onboarding-flow${config ? ' is-numeric' : ''}${key === 'safety' ? ' is-safety' : ''}`} aria-busy={locked}>
    <nav className="onboarding-top" aria-label={t('问答导航', 'Question navigation')}><button type="button" disabled={locked || current === 0} onClick={back}>{t('返回', 'back')}</button><span>{t('你的训练手记', 'YOUR TRAINING JOURNAL')}</span>{!summary && key !== 'biologicalSex' && <button type="button" disabled={locked} onClick={() => void save(true)}>{t('跳过', 'skip')}</button>}</nav>
    <progress aria-label={t('资料引导大致进度', 'Approximate profile setup progress')} value={summary ? 8 : categoryIndex + (localIndex - 1) / localTotal} max={8} />
    <div className="onboarding-category"><span>{summary ? t('准备出发', 'READY WHEN YOU ARE') : category.label[en ? 1 : 0]}</span>{!summary && <small>{localIndex} / {localTotal}</small>}</div>
    <div className="onboarding-question" key={current}>
      <div className="onboarding-hero"><QuestionIllustration question={summary ? 'welcome' : key} /></div><div className="onboarding-paper">
      <h2 ref={heading} tabIndex={-1}>{title}</h2>
      <p className="onboarding-support">{summary ? t('只保留你提供的内容。接下来先核对 AI 的理解，再一起制定计划。', 'Only what you shared. Next, review AI’s understanding before planning together.') : support}</p>
      <div className="onboarding-interaction">
        {summary ? <dl className="onboarding-summary">{answered.map(([name, item]) => <div key={name}><dt>{prompts[name as GuidedQuestion]?.[en ? 1 : 0]}<button type="button" disabled={locked} onClick={() => onStepChange(name === 'biologicalSex' ? 16 : guidedSteps.indexOf(name as GuidedQuestion))}>{t('修改', 'Edit')}</button></dt><dd>{valuesOf(item).map(value => translatedValue(value, en)).join(en ? ', ' : '、')}{numbers[name as GuidedQuestion]?.unit ? ` ${numbers[name as GuidedQuestion]?.unit}` : ''}</dd></div>)}{!answered.length && <p>{t('你尚未提供资料，可以在后续对话中补充。', 'No details shared yet. You can add them in the conversation.')}</p>}</dl> : config ? <button type="button" className="onboarding-numeric-choice" disabled={locked} onClick={event => setModal({ initial: numeric, trigger: event.currentTarget })}><strong>{numeric === '' ? '—' : numeric}</strong><span>{config.unit || t('岁', 'years')}</span><span>{numeric === '' ? t('填写数值', 'Choose a value') : t('点击调整', 'Tap to adjust')} <span aria-hidden="true">↗</span></span></button> : <>
          <div className={`onboarding-options${multiple ? ' is-multiple' : ''}`} role="group" aria-label={title}>{options.map(([value, english], i) => <button type="button" key={value} aria-pressed={selected.includes(value)} disabled={locked} onClick={() => toggle(value)}><span className="onboarding-option-mark" aria-hidden="true">{selected.includes(value) ? '✓' : String(i + 1).padStart(2, '0')}</span><span>{en ? english : translatedValue(value, false)}</span></button>)}</div>
          {customValues.map(value => <div className="onboarding-custom-row" key={value}><button type="button" className="onboarding-custom-answer" disabled={locked} onClick={event => setModal({ initial: value.replace(/^(单次时长：|避免：)/, ''), custom: value, trigger: event.currentTarget })}>{translatedValue(value, en)} <small>{t('编辑', 'Edit')}</small></button><button type="button" disabled={locked} aria-label={`${t('移除补充', 'Remove detail')}: ${translatedValue(value, en)}`} onClick={() => setSelected(previous => previous.filter(item => item !== value))}>×</button></div>)}
          {key !== 'biologicalSex' && (key !== 'safety' || safetyDetails) ? <button type="button" className="onboarding-custom" disabled={locked} onClick={event => setModal({ initial: safetyDetails ? selected[0] ?? '' : '', custom: safetyDetails ? selected[0] : undefined, trigger: event.currentTarget })}>{safetyDetails ? t('说明必要的限制', 'Share the relevant restrictions') : t('自定义 / 补充说明', 'Something else / add detail')} <span aria-hidden="true">↗</span></button> : null}
        </>}
      </div>
    </div></div>
    {(error || localError) && <p role="alert">{localError || t('未能完成操作，已保存的回答仍保留。请重试。', 'Could not complete this action. Saved answers are retained. Please retry.')}</p>}
    <div className="onboarding-bottom"><button type="button" className="guided-primary" disabled={locked || !summary && !valid} onClick={summary ? () => { if (answers.biologicalSex?.status !== 'answered') onStepChange(16); else onComplete(); } : () => void save(false)}>{locked ? t('保存中…', 'saving…') : summary ? t('与 AI 一起制定计划', 'Plan together with AI') : t('确认并继续', 'confirm and continue')}<span aria-hidden="true"> →</span></button></div>
    <button type="button" className="guided-text-action" disabled={locked} onClick={() => setReset(true)}>{t('重新开始引导', 'restart onboarding')}</button>
    {modal && <OnboardingInputDialog locale={locale} title={title} config={config} initial={modal.initial} returnFocusTo={modal.trigger} onClose={() => setModal(undefined)} onApply={value => {
      if (config) { setNumeric(value); return; }
      const text = duration ? `单次时长：${value}` : avoidance ? `避免：${value}` : String(value);
      if (!multiple) setSelected([text]);
      else setSelected(previous => [...previous.filter(item => item !== modal.custom && item !== '没有特别偏好' && item !== '没有特别想避开的运动' && item !== '徒手' && item !== text), text]);
    }} />}
    <dialog ref={resetDialog} className="onboarding-input-dialog" aria-labelledby="guided-reset-title" onCancel={event => { event.preventDefault(); setReset(false); }}><h2 id="guided-reset-title">{t('重新开始引导？', 'restart onboarding?')}</h2><p>{t('只清除引导答案和进度，保留已有计划和训练历史。', 'Clear onboarding answers and progress; keep existing plans and training history.')}</p><footer><button type="button" autoFocus onClick={() => setReset(false)}>{t('保留进度', 'keep progress')}</button><button type="button" disabled={locked} onClick={() => { onReset(); setReset(false); }}>{t('确认重新开始', 'confirm restart')}</button></footer></dialog>
  </section>;
}
