import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h } from 'react';
import { describe, expect, it } from 'vitest';
import { OnboardingPage, type OnboardingAnswers } from '../../src/ui/pages/onboarding/OnboardingPage';
import { PlanDraftPage, type OnboardingProposal } from '../../src/ui/pages/onboarding/PlanDraftPage';
import type { ThemeSlots } from '../../src/themes/contract';
const slots: Pick<ThemeSlots, 'BrandMark' | 'AiLine' | 'Suggestions'> = {
  BrandMark: ({ label }) => h('span', {}, label), AiLine: ({ children }) => h('div', {}, children), Suggestions: () => null,
};
const answers: OnboardingAnswers = { goalText: '<script>private words</script>', scheduleOriginalText: '15 minutes', placeEquipmentText: 'My equipment', adultConfirmed: false, cautions: [] };
describe('onboarding presentation boundaries', () => {
  it('rendering safety never generates and escapes original text in the consent list', () => {
    let calls = 0;
    const html = renderToStaticMarkup(h(OnboardingPage, { locale: 'en', step: 3, answers, slots, mode: 'ai', onChange() {}, onStep() {}, onGenerate() { calls++; }, onManual() {} }));
    expect(calls).toBe(0); expect(html).toContain('&lt;script&gt;private words&lt;/script&gt;');
    expect(html).not.toContain('<script>'); expect(html).toContain('15 minutes');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Generate my first plan/);
  });
  it('incomplete answers cannot generate even with an adult declaration', () => {
    const html = renderToStaticMarkup(h(OnboardingPage, { locale: 'en', step: 3, answers: { ...answers, adultConfirmed: true, goalText: '   ' }, slots, mode: 'basic', onChange() {}, onStep() {}, onGenerate() {}, onManual() {} }));
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Generate my first plan/); expect(html).not.toContain('<details>');
  });
  it('draft render never saves and shows metric values without translating custom text', () => {
    let saves = 0;
    const candidate: OnboardingProposal = { type: 'plan_proposal', requestId: 'id', restoreGeneration: 7, mutationAllowed: false, proposal: { goalText: '我的原话', weeklyTarget: 2, sessionMinutes: 15, scheduleOriginalText: '15 minutes', reasons: ['a', 'b', 'c'], templates: [{ id: 't', name: '自定义训练', estimatedMinutes: 15, items: [{ exerciseId: 'e', equipment: '我的器械', sets: 2, target: { metricType: 'reps_load', reps: 8, loadGrams: 1250 } }] }] } };
    const html = renderToStaticMarkup(h(PlanDraftPage, { locale: 'en', candidate, slots, exerciseText: () => ({ name: 'My exercise', instructions: 'My instructions' }), onConfirm() { saves++; }, onDiscuss() {} }));
    expect(saves).toBe(0); expect(html).toContain('我的原话'); expect(html).toContain('自定义训练'); expect(html).toContain('1.25 kg'); expect(html).toContain('8 reps');
    for (const [code, label] of [['none', '无需器械'], ['dumbbell', '哑铃'], ['custom-equipment', 'custom-equipment']]) {
      candidate.proposal.templates[0].items[0].equipment = code;
      const localized = renderToStaticMarkup(h(PlanDraftPage, { locale: 'zh', candidate, slots, exerciseText: () => ({ name: '动作', instructions: '要领' }), onConfirm() {}, onDiscuss() {} }));
      expect(localized).toContain(`<p>${label}</p>`);
      if (code !== label) expect(localized).not.toContain(`<p>${code}</p>`);
    }
  });
});
