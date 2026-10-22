import { useCallback, useEffect, useState } from 'react';
import type { FitnessTestRecord } from '../../../domain/plan-upgrade';
import { listFitnessTests } from '../../../persistence/plan-upgrade-store';
import { activityDate } from '../../../application/v8-activity';
import { energyCopy } from '../../../i18n/features/me/energy';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { useMainline } from '../../mainline/context';
import { FitnessTestCard } from '../plan-upgrade/FitnessTestCard';
import { Head } from './EnergyPages';
import './energy.css';
import '../plan-upgrade/plan-upgrade.css';
import { DEFAULT_TIME_ZONE } from '../../../domain/local-date';

/** 我的 › 自测组件 › 体能自测 (Bo 2026-10-22, moved from 我的山路): home items of the 2023 national standard, kept on this device. */
export function FitnessTestPage() {
  const { data, locale } = useMainline();
  const values = data?.profile?.bodyDetails?.values;
  const today = activityDate(data?.profile?.timeZone ?? DEFAULT_TIME_ZONE);
  const [tests, setTests] = useState<FitnessTestRecord[]>([]);
  const reload = useCallback(async () => { try { setTests(await listFitnessTests()); } catch { setTests([]); } }, []);
  useEffect(() => { void reload(); }, [reload]);
  const sex = values?.biologicalSex === '男性' ? 'male' as const : values?.biologicalSex === '女性' ? 'female' as const : undefined;
  return <main className="v9-energy">
    <Head title={planPagesCopy[locale].testTitle} sub={energyCopy[locale].testSub}/>
    <FitnessTestCard locale={locale} today={today} {...(values?.age !== undefined ? { age: values.age } : {})} {...(sex ? { sex } : {})} tests={tests} onSaved={() => void reload()}/>
  </main>;
}
