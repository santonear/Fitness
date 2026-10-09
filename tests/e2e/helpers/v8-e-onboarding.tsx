import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OnboardingPage, type OnboardingAnswers } from '../../../src/ui/pages/onboarding/OnboardingPage';
import { PlanDraftPage, type OnboardingProposal } from '../../../src/ui/pages/onboarding/PlanDraftPage';
import type { ThemeSlots } from '../../../src/themes/contract';
import { Button } from '../../../src/ui/components/common';
import '../../../src/ui/theme.css';
import './v8-e-onboarding.css';

// Deliberately test-only neutral slots; production theme signatures are not implemented here.
const slots: Pick<ThemeSlots, 'BrandMark' | 'AiLine' | 'Suggestions'> = {
  BrandMark: ({ label }) => <strong className="fixture-brand">{label}</strong>,
  AiLine: ({ children }) => <div>{children}</div>,
  Suggestions: ({ label, options, onSelect, disabled }) => <section className="fixture-suggestions" aria-label={label}><span>{label}</span>{options.map(option => <Button key={option.id} disabled={disabled} onClick={() => onSelect(option.id)}>{option.label}</Button>)}</section>,
};
const candidate: OnboardingProposal = {
  type: 'plan_proposal', requestId: '00000000-0000-4000-8000-000000000001', restoreGeneration: 2, mutationAllowed: false,
  proposal: { goalText: '想有些力量，不再容易累', weeklyTarget: 2, scheduleOriginalText: '每周 2 次，每次 30 分钟', sessionMinutes: 30,
    templates: ['全身 A', '全身 B'].map((name, i) => ({ id: String(i), name, estimatedMinutes: 30, items: [{ exerciseId: 'squat', equipment: '瑜伽垫', sets: 2, target: { metricType: 'reps', reps: 8 } }] })),
    reasons: ['从熟悉动作开始。', '两次训练之间留出休息。', '每次约半小时，方便安排。'],
  },
};
const query = new URLSearchParams(location.search);
document.documentElement.dataset.theme = query.get('theme') ?? 'qingci';
function Fixture() {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({ goalText: '', scheduleOriginalText: '', placeEquipmentText: '', adultConfirmed: false, cautions: [] });
  const [generated, setGenerated] = useState(0), [confirmed, setConfirmed] = useState(0), [manual, setManual] = useState(0);
  const [draft, setDraft] = useState(query.has('draft'));
  const props = { locale: query.get('lang') === 'en' ? 'en' as const : 'zh' as const, slots };
  return <>{draft ? <PlanDraftPage {...props} candidate={candidate} busy={query.has('busy')} exerciseText={() => ({ name: '深蹲', instructions: '在舒适的幅度内屈膝。' })} onConfirm={value => { if (value === candidate) setConfirmed(n => n + 1); }} onDiscuss={() => setDraft(false)} /> : <OnboardingPage {...props} step={step} onStep={setStep} answers={answers} onChange={setAnswers} mode={query.has('basic') ? 'basic' : 'ai'} busy={query.has('busy')} onGenerate={() => { setGenerated(n => n + 1); setDraft(true); }} onManual={() => setManual(n => n + 1)} />}
    <aside className="fixture-counts" aria-label="Test-only callbacks"><output aria-label="generate calls">{generated}</output><output aria-label="confirm calls">{confirmed}</output><output aria-label="manual calls">{manual}</output></aside>
  </>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
