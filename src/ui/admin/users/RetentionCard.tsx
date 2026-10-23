import { useEffect, useState } from 'react';
import { useFeature } from '../../useFeature';

type Language = 'zh' | 'en';
interface Retention {
  from: string;
  to: string;
  start: number;
  week1: number;
  week4: number;
}
const copy = {
  zh: {
    title: '留存',
    note: '只统计同意匿名统计的设备，按次数汇总，不含任何训练内容。',
    range: '{from} 至 {to} 开始的计划',
    start: '开始计划',
    week1: '第一周练过',
    week4: '第四周还在练',
    empty: '这段时间还没有数据。',
    error: '暂时读不到，请刷新重试。',
    loading: '正在读取…',
  },
  en: {
    title: 'Retention',
    note: 'Opted-in devices only, counted in totals. No training content.',
    range: 'Plans started {from} to {to}',
    start: 'Started a plan',
    week1: 'Trained in week 1',
    week4: 'Still training in week 4',
    empty: 'No data for this period yet.',
    error: 'Not available right now. Refresh to retry.',
    loading: 'Loading…',
  },
};
const percent = (part: number, whole: number) => (whole ? `${Math.min(100, Math.round((part / whole) * 100))}%` : '–');

/** 待办 side card (Bo 2026-10-23, item 10): anonymous cohort rates from the opt-in usage counts. */
export function RetentionCard({ language }: { language: Language }) {
  return useFeature('anonymousUsage') ? <RetentionFigures language={language} /> : null;
}
function RetentionFigures({ language }: { language: Language }) {
  const t = copy[language];
  const [data, setData] = useState<Retention>(),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/api/v1/management/usage-counts', { credentials: 'same-origin' })
      .then(response => (response.ok ? (response.json() as Promise<{ retention?: Retention }>) : Promise.reject()))
      .then(body => {
        if (!live) return;
        if (body.retention) setData(body.retention);
        else setFailed(true);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="admin-card" aria-label={t.title}>
      <h2>{t.title}</h2>
      <p className="admin-muted">{t.note}</p>
      {failed ? (
        <p role="alert">{t.error}</p>
      ) : !data ? (
        <p role="status">{t.loading}</p>
      ) : !data.start ? (
        <p className="admin-empty">{t.empty}</p>
      ) : (
        <>
          <p className="admin-muted">{t.range.replace('{from}', data.from).replace('{to}', data.to)}</p>
          <div className="admin-figures">
            <div>
              <span>{t.start}</span>
              <strong>{data.start}</strong>
            </div>
            <div>
              <span>{t.week1}</span>
              <strong>{percent(data.week1, data.start)}</strong>
            </div>
            <div>
              <span>{t.week4}</span>
              <strong>{percent(data.week4, data.start)}</strong>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
