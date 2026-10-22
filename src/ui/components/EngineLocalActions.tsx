import { useState } from 'react';
import type { CoachRequest } from '../../coach/contracts';
import type { LocalEngineAction } from '../../application/engine-plan';
import type { SubstituteReason } from '../../engine/contracts';
import { exercises } from '../../catalog/exercises';
import { Button } from './common';
import { getEligibleExercises } from '../../engine';
import coachZh from '../../i18n/features/coach/zh.json';
import coachEn from '../../i18n/features/coach/en.json';

export function EngineLocalActions({
  request,
  locale,
  busy,
  onAction,
  onGuide,
  onGenerate,
}: {
  request: CoachRequest;
  locale: 'zh' | 'en';
  busy: boolean;
  onAction: (action: LocalEngineAction) => void;
  onGuide: (id: string) => void;
  onGenerate: () => void;
}) {
  const [minutes, setMinutes] = useState(15),
    [itemIndex, setItemIndex] = useState(0),
    [reason, setReason] = useState<SubstituteReason>('equipment');
  const [templateIndex, setTemplateIndex] = useState(0),
    [replacementId, setReplacementId] = useState('');
  if (request.task === 'ONBOARD_PLAN')
    return (
      <fieldset disabled={busy}>
        <Button onClick={onGenerate}>{(locale === 'zh' ? coachZh : coachEn).localPlan}</Button>
      </fieldset>
    );
  if (request.task === 'MODIFY_PLAN') {
    const template = request.plan.templates[templateIndex],
      item = template?.items[itemIndex];
    const candidates = request.engineProfile
      ? getEligibleExercises(request.engineProfile)
          .filter(row => row.exerciseId !== item?.exerciseId)
          .slice(0, 60)
      : [];
    return (
      <fieldset disabled={busy}>
        <label>
          {locale === 'zh' ? '训练单' : 'Training template'}
          <select
            value={templateIndex}
            onChange={event => {
              setTemplateIndex(Number(event.target.value));
              setItemIndex(0);
              setReplacementId('');
            }}
          >
            {request.plan.templates.map((row, index) => (
              <option key={row.id} value={index}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {locale === 'zh' ? '分钟' : 'Minutes'}
          <select value={minutes} onChange={event => setMinutes(Number(event.target.value))}>
            {[10, 15, 20, 30].map(value => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <Button
          disabled={!template}
          onClick={() => onAction({ kind: 'modify', changes: [{ op: 'shorten', templateId: template.id, minutes }] })}
        >
          {locale === 'zh' ? '缩短到所选时长' : 'Shorten to selected duration'}
        </Button>
        <label>
          {locale === 'zh' ? '动作' : 'Exercise'}
          <select
            value={itemIndex}
            onChange={event => {
              setItemIndex(Number(event.target.value));
              setReplacementId('');
            }}
          >
            {template?.items.map((row, index) => (
              <option key={index} value={index}>
                {exercises.find(exercise => exercise.id === row.exerciseId)?.name[locale] ?? row.exerciseId}
              </option>
            ))}
          </select>
        </label>
        <label>
          {locale === 'zh' ? '换掉' : 'Replace'}
          <select value={replacementId} onChange={event => setReplacementId(event.target.value)}>
            <option value="">{locale === 'zh' ? '请选择' : 'Choose'}</option>
            {candidates.map(row => (
              <option key={row.exerciseId} value={row.exerciseId}>
                {exercises.find(exercise => exercise.id === row.exerciseId)?.name[locale] ?? row.exerciseId}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={!item || !replacementId}
          onClick={() =>
            onAction({
              kind: 'modify',
              changes: [{ op: 'replace', templateId: template.id, itemIndex, replacementId }],
            })
          }
        >
          {locale === 'zh' ? '换掉所选动作' : 'Replace selected exercise'}
        </Button>
        <Button disabled={!item} onClick={() => onGuide(item.exerciseId)}>
          {locale === 'zh' ? '动作怎么做' : 'Exercise guidance'}
        </Button>
      </fieldset>
    );
  }
  if (request.task !== 'ADJUST_TODAY') return null;
  const zh = locale === 'zh';
  return (
    <fieldset disabled={busy}>
      <legend>{zh ? '本地调整' : 'Local adjustments'}</legend>
      <label>
        {zh ? '分钟' : 'Minutes'}
        <select value={minutes} onChange={event => setMinutes(Number(event.target.value))}>
          {[10, 15, 20, 30].map(value => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <Button onClick={() => onAction({ kind: 'adjust', request: { minutes } })}>
        {zh ? '缩短到所选时长' : 'Shorten to selected duration'}
      </Button>
      {(['upper', 'lower', 'core'] as const).map((focus, index) => (
        <Button key={focus} onClick={() => onAction({ kind: 'adjust', request: { focus } })}>
          {(zh ? ['只练上肢', '只练下肢', '只练核心'] : ['Upper body only', 'Lower body only', 'Core only'])[index]}
        </Button>
      ))}
      <label>
        {zh ? '动作' : 'Exercise'}
        <select value={itemIndex} onChange={event => setItemIndex(Number(event.target.value))}>
          {request.template.items.map((item, index) => (
            <option key={index} value={index}>
              {exercises.find(row => row.id === item.exerciseId)?.name[locale] ?? item.exerciseId}
            </option>
          ))}
        </select>
      </label>
      <label>
        {zh ? '替换原因' : 'Reason for replacement'}
        <select value={reason} onChange={event => setReason(event.target.value as SubstituteReason)}>
          {(['equipment', 'pain', 'dislike', 'too_hard', 'too_easy'] as const).map((value, index) => (
            <option key={value} value={value}>
              {
                (zh
                  ? ['没有器械', '不舒服', '不喜欢', '太难', '太轻']
                  : ['Equipment unavailable', 'Discomfort', 'Dislike', 'Too hard', 'Too easy'])[index]
              }
            </option>
          ))}
        </select>
      </label>
      <Button onClick={() => onAction({ kind: 'substitute', itemIndex, reason })}>
        {zh ? '换掉所选动作' : 'Replace selected exercise'}
      </Button>
      <label>
        {zh ? '某部位不舒服' : 'Area of discomfort'}
        <select
          defaultValue=""
          onChange={event => {
            if (event.target.value)
              onAction({
                kind: 'adjust',
                request: { painArea: event.target.value as 'knee' | 'back' | 'shoulder' | 'wrist' | 'other' },
              });
            event.target.value = '';
          }}
        >
          <option value="">{zh ? '选择部位' : 'Choose an area'}</option>
          {(['knee', 'back', 'shoulder', 'wrist', 'other'] as const).map((value, index) => (
            <option key={value} value={value}>
              {(zh ? ['膝', '腰背', '肩', '腕', '其他'] : ['Knee', 'Back', 'Shoulder', 'Wrist', 'Other'])[index]}
            </option>
          ))}
        </select>
      </label>
      <Button
        onClick={() => {
          const item = request.template.items[itemIndex];
          if (item) onGuide(item.exerciseId);
        }}
      >
        {zh ? '动作怎么做' : 'Exercise guidance'}
      </Button>
    </fieldset>
  );
}
