import { Rules } from '../../../engine/data';
import type { WorkoutRecord } from '../../../domain/v8/contracts';
import { engineTrainingCopy } from '../../../i18n/features/training/engine';
import type { PainFollowupInput } from '../../../application/pain-followup';
import { useEffect, useState } from 'react';
import type { TrainingCheckinInput } from '../../../application/training-checkin';
import { JointPainCheckinFields, type JointPainCheckinDraft } from './JointPainCheckinFields';
import { PainAreaPicker } from './PainCheckinPanel';
import { binarySex } from '../../../domain/body-profile';
import { engineCopy } from '../../../coach/engine-copy';
import { useMainline, workflow } from '../../mainline/context';
import { useFeature } from '../../useFeature';
import { Button } from '../../components/common';
import { ChoiceChip, ChoiceRow } from '../../components/kit';

const followupRules = new Rules();
export function PainFollowupFields({
  answers,
  onChange,
  locale,
  workouts = [],
  sex,
}: {
  answers: PainFollowupInput & { jointPain?: JointPainCheckinDraft };
  onChange: (answers: PainFollowupInput & { jointPain?: JointPainCheckinDraft }) => void;
  locale: 'zh' | 'en';
  workouts?: WorkoutRecord[];
  sex?: 'male' | 'female';
}) {
  const t = engineTrainingCopy[locale],
    zh = locale === 'zh';
  const [selection, setSelection] = useState(
      answers.painFollowup ? JSON.stringify([answers.painFollowup.workoutId, answers.painFollowup.itemIndex]) : '',
    ),
    [area, setArea] = useState(answers.painFollowup?.painArea),
    [side, setSide] = useState(answers.jointPain?.painSide);
  const choices = workouts
    .filter(w => ['complete', 'partial'].includes(w.status) && w.endedAt)
    .flatMap(w =>
      [...new Set(w.sets.map(s => s.itemIndex))].flatMap(index => {
        const ids = [...new Set(w.sets.filter(s => s.itemIndex === index).map(s => s.exerciseId))],
          e = ids.length === 1 ? followupRules.byExercise.get(ids[0]) : undefined;
        return e ? [{ value: JSON.stringify([w.id, index]), name: `${w.localDate} · ${e.name[locale]}` }] : [];
      }),
    );
  function link(value: string, nextArea: typeof area, nextSide = side) {
    setSelection(value);
    setArea(nextArea);
    setSide(nextSide);
    const pair = value ? (JSON.parse(value) as [string, number]) : undefined;
    // The side only labels the joint check below (右膝); the follow-up itself keeps the area.
    const jointPain = { ...answers.jointPain };
    delete jointPain.painSide;
    onChange({
      ...answers,
      painFollowup: pair && nextArea ? { workoutId: pair[0], itemIndex: pair[1], painArea: nextArea } : undefined,
      ...(answers.jointPain || nextSide
        ? {
            jointPain: {
              ...jointPain,
              ...(nextSide ? { painSide: nextSide } : {}),
              ...(nextArea !== area ? { redFlagAnswers: undefined } : {}),
            },
          }
        : {}),
    });
  }
  // The two source questions are asked by the merged pain question (TrainingCheckinFields); here only which session and where.
  return answers.painLastedToNextMorning === true || answers.painOrStiffnessWorseThanLastWeek === true ? (
    <>
      <select aria-label={t.choose} value={selection} onChange={event => link(event.target.value, area)}>
        <option value="">{t.choose}</option>
        {choices.map(choice => (
          <option key={choice.value} value={choice.value}>
            {choice.name}
          </option>
        ))}
      </select>
      <PainAreaPicker
        locale={locale}
        sex={sex}
        value={{ painArea: area, ...(side ? { painSide: side } : {}) }}
        onChange={next => link(selection, next.painArea, next.painSide)}
      />
    </>
  ) : null;
}
export function TrainingCheckinFields({
  answers,
  onChange,
  locale,
  disabled,
  workouts = [],
  sex,
}: {
  answers: TrainingCheckinInput;
  onChange: (answers: TrainingCheckinInput) => void;
  locale: 'zh' | 'en';
  disabled: boolean;
  workouts?: WorkoutRecord[];
  /** Figure for the pain picker, from the profile. */
  sex?: 'male' | 'female';
}) {
  const zh = locale === 'zh',
    hasPreviousTraining = workouts.some(
      workout => ['complete', 'partial'].includes(workout.status) && !!workout.endedAt && workout.sets.length > 0,
    );
  // One pain question instead of three (Bo 2026-10-26): 有 opens the kinds, each kind keeps its own answer field.
  const kinds = [
    ['newOrWorseJointPain', zh ? '新出现' : 'New'],
    ...(hasPreviousTraining
      ? ([
          ['painLastedToNextMorning', zh ? '持续到第二天早上' : 'Lasted to the next morning'],
          ['painOrStiffnessWorseThanLastWeek', zh ? '比上周更重' : 'Worse than last week'],
        ] as const)
      : []),
  ] as const;
  const anyKind = kinds.some(([key]) => answers[key] === true),
    noKind = kinds.every(([key]) => answers[key] === false);
  const [hurt, setHurt] = useState<boolean | undefined>(anyKind ? true : noKind ? false : undefined);
  const yesNo = [
    [true, zh ? '是' : 'Yes'],
    [false, zh ? '否' : 'No'],
  ] as const;
  return (
    <fieldset disabled={disabled} className="v9-checkin-fields">
      <ChoiceRow
        label={zh ? '最近练后有没有哪里疼？' : 'Any pain after recent training?'}
        options={[
          [false, zh ? '没有' : 'No'],
          [true, zh ? '有' : 'Yes'],
        ]}
        value={hurt}
        onPick={value => {
          setHurt(value);
          const all = (answer: boolean | undefined) => Object.fromEntries(kinds.map(([key]) => [key, answer]));
          if (value !== true)
            onChange({
              ...answers,
              ...all(value === false ? false : undefined),
              painFollowup: undefined,
              jointPain: undefined,
            });
        }}
      />
      {hurt && (
        <div className="v9-choice-row" role="group" aria-label={zh ? '是哪种？可多选' : 'Which kind? Pick any'}>
          <span>{zh ? '是哪种？可多选' : 'Which kind? Pick any'}</span>
          <div className="v9-choice-chips">
            {kinds.map(([key, text]) => (
              <ChoiceChip
                key={key}
                size="sm"
                selected={answers[key] === true}
                onClick={() => {
                  const answer = answers[key] !== true;
                  onChange({
                    ...answers,
                    [key]: answer,
                    ...(key === 'newOrWorseJointPain' && !answer ? { jointPain: undefined } : {}),
                    ...(key !== 'newOrWorseJointPain' && !answer ? { painFollowup: undefined } : {}),
                  });
                }}
              >
                {text}
              </ChoiceChip>
            ))}
          </div>
        </div>
      )}
      {hasPreviousTraining && (
        <PainFollowupFields
          answers={answers}
          onChange={next => onChange({ ...answers, ...next })}
          locale={locale}
          workouts={workouts}
          sex={sex}
        />
      )}
      <ChoiceRow
        label={engineCopy('deload.copy.checkin.0', locale)}
        options={[1, 2, 3, 4, 5].map(value => [value, String(value)] as const)}
        value={answers.energyMotivation}
        onPick={value => onChange({ ...answers, energyMotivation: value })}
      />
      {/* 几晚没睡好 is no longer asked (Bo 2026-10-26): the energy question covers it; the optional field stays. */}
      {hasPreviousTraining && (
        <ChoiceRow
          label={engineCopy('deload.copy.checkin.2', locale)}
          options={yesNo}
          value={answers.sorenessResolved}
          onPick={value => onChange({ ...answers, sorenessResolved: value })}
        />
      )}
      {(answers.newOrWorseJointPain === true ||
        (hasPreviousTraining &&
          (answers.painLastedToNextMorning === true || answers.painOrStiffnessWorseThanLastWeek === true))) && (
        <>
          <p role="status">{engineCopy('pain.copy.stop_exercise', locale)}</p>
          <JointPainCheckinFields
            value={{
              ...answers.jointPain,
              ...(answers.painFollowup ? { painArea: answers.painFollowup.painArea } : {}),
            }}
            onChange={jointPain => onChange({ ...answers, jointPain })}
            locale={locale}
            disabled={disabled}
            sex={sex}
            areaLocked={!!answers.painFollowup}
          />
        </>
      )}
    </fieldset>
  );
}
function ConsentedCheckin() {
  const c = useMainline(),
    revision = c.data!.metadata.dataRevision;
  const [draft, setDraft] = useState<{ revision: number; answers: TrainingCheckinInput }>();
  useEffect(() => {
    let alive = true;
    void workflow
      .pendingTrainingCheckin()
      .then(answers => {
        if (alive) setDraft({ revision, answers: answers ?? {} });
      })
      .catch(() => {
        if (alive) setDraft(undefined);
      });
    return () => {
      alive = false;
    };
  }, [revision]);
  const ready = draft?.revision === revision;
  return (
    <section>
      <TrainingCheckinFields
        answers={ready ? draft.answers : {}}
        onChange={answers => setDraft({ revision, answers })}
        locale={c.locale}
        disabled={c.busy || !ready}
        workouts={c.data?.workouts ?? []}
        sex={binarySex(c.data?.profile?.bodyDetails?.values?.biologicalSex)}
      />
      <Button
        disabled={c.busy || !ready}
        onClick={() =>
          void c.run(async () => {
            await workflow.saveTrainingCheckin(draft!.answers, revision);
            await c.reload();
          })
        }
      >
        {c.t.confirm}
      </Button>
    </section>
  );
}
export function PreTrainingCheckin() {
  const enabled = useFeature('trainingEngine'),
    c = useMainline();
  return enabled && c.data?.state?.coachProfile?.healthStorageConsent && !c.data.active ? <ConsentedCheckin /> : null;
}
