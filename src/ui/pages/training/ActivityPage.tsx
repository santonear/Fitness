import { useState } from 'react';
import { TEXT_LIMITS, textIssue } from '../../../domain/input-guard';
import { FieldIssue } from '../../components/common/FieldIssue';
import type { ActivityRecord, Feel } from '../../../domain/v8/contracts';
import { activityDate, createActivityService } from '../../../application/v8-activity';
import { repository } from '../../../persistence/repository';
import { Button, Chip } from '../../components/common';
import { useMainline } from '../../mainline/context';
import { HomeExit } from '../../components/HomeExit';
import '../plan/week-plan.css';
import zh from '../../../i18n/features/training/activity.zh.json';
import en from '../../../i18n/features/training/activity.en.json';
const types = ['walk', 'run', 'cycle', 'swim', 'yoga', 'stairs', 'other'] as const;
const feels = ['easy', 'right', 'tired', 'very_tired'] as const;
/** One activity record covers at most ten hours. */
const MAX_MINUTES = 600;
export function ActivityPage() {
  const c = useMainline(),
    t = c.locale === 'zh' ? zh : en;
  const [id] = useState(() => crypto.randomUUID()),
    [revision] = useState(() => c.data!.metadata.dataRevision),
    [generation] = useState(() => c.data!.metadata.restoreGeneration ?? 0);
  const [type, setType] = useState<ActivityRecord['type']>(),
    [minutes, setMinutes] = useState(30),
    [customName, setCustomName] = useState(''),
    [feel, setFeel] = useState<Feel>(),
    [note, setNote] = useState('');
  const zone = c.data?.profile?.timeZone ?? 'Asia/Shanghai',
    today = activityDate(zone),
    earliest = activityDate(zone, -365);
  const nameIssue = type === 'other' ? textIssue(customName, TEXT_LIMITS.name) : undefined,
    noteIssue = textIssue(note, TEXT_LIMITS.long);
  const [when, setWhen] = useState('now'),
    [date, setDate] = useState(today);
  return (
    <main>
      <nav className="v9-plan-nav" aria-label={t.title}>
        <HomeExit
          locale={c.locale}
          dirty={!!type || !!note.trim() || !!customName.trim()}
          onLeave={() => c.navigate('/')}
        />
      </nav>
      <Button onClick={() => c.navigate('/')}>{c.t.back}</Button>
      <h1>{t.title}</h1>
      <fieldset>
        <legend>{t.type}</legend>
        <div className="v8-capsules">
          {types.map(k => (
            <Chip key={k} selected={type === k} onClick={() => setType(k)}>
              {t.types[k]}
            </Chip>
          ))}
        </div>
      </fieldset>
      {type === 'other' && (
        <label>
          {t.customName}
          <input
            value={customName}
            maxLength={TEXT_LIMITS.name}
            aria-invalid={nameIssue ? true : undefined}
            onChange={e => setCustomName(e.target.value)}
          />
          <FieldIssue issue={nameIssue} locale={c.locale} max={TEXT_LIMITS.name} />
        </label>
      )}
      <label>
        {t.duration}
        <input
          type="number"
          min={5}
          max={MAX_MINUTES}
          step={1}
          required
          value={Number.isNaN(minutes) ? '' : minutes}
          onChange={e => setMinutes(e.target.valueAsNumber)}
        />
      </label>
      <div className="v8-row">
        <Button aria-label={t.less} disabled={minutes <= 5} onClick={() => setMinutes(Math.max(5, minutes - 10))}>
          −10
        </Button>
        <Button
          aria-label={t.more}
          disabled={minutes >= MAX_MINUTES}
          onClick={() => setMinutes(Math.min(MAX_MINUTES, minutes + 10))}
        >
          +10
        </Button>
      </div>
      <fieldset>
        <legend>{t.when}</legend>
        <div className="v8-capsules">
          {(['now', 'earlier', 'yesterday', 'date'] as const).map(k => (
            <Chip
              key={k}
              selected={when === k}
              onClick={() => {
                setWhen(k);
                if (k !== 'date') setDate(activityDate(zone, k === 'yesterday' ? -1 : 0));
              }}
            >
              {t.times[k]}
            </Chip>
          ))}
        </div>
      </fieldset>
      {when === 'date' && (
        <label>
          {t.date}
          <input type="date" min={earliest} max={today} value={date} onChange={e => setDate(e.target.value)} />
        </label>
      )}
      <fieldset>
        <legend>{c.t.feel}</legend>
        <div className="v8-capsules">
          {feels.map((f, i) => (
            <Chip key={f} selected={feel === f} onClick={() => setFeel(feel === f ? undefined : f)}>
              {c.t.feelOptions[i]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <label>
        {c.t.note}
        <textarea
          value={note}
          maxLength={TEXT_LIMITS.long}
          aria-invalid={noteIssue ? true : undefined}
          onChange={e => setNote(e.target.value)}
        />
        <FieldIssue issue={noteIssue} locale={c.locale} max={TEXT_LIMITS.long} />
      </label>
      <p>{t.hint}</p>
      <Button
        variant="primary"
        disabled={
          c.busy ||
          !type ||
          !Number.isInteger(minutes) ||
          minutes < 5 ||
          minutes > MAX_MINUTES ||
          !date ||
          date > today ||
          date < earliest ||
          !!nameIssue ||
          !!noteIssue
        }
        onClick={() =>
          void c.run(async () => {
            if (!type) return;
            await createActivityService(repository).save(
              {
                id,
                type,
                minutes,
                localDate: date,
                timeZone: zone,
                ...(type === 'other' && customName.trim() ? { customName: customName.trim() } : {}),
                ...(feel ? { feel } : {}),
                ...(note.trim() ? { note: note.trim() } : {}),
              },
              revision,
              generation,
            );
            c.navigate('/review');
          })
        }
      >
        {c.t.save}
      </Button>
    </main>
  );
}
