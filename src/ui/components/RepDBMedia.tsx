import { useState } from 'react';
import { catalogMetadata } from '../../catalog/registry';
import type { Locale } from '../../domain/models';
import { RepDBAttribution } from './RepDBAttribution';

export function CatalogImage({ src, alt, locale }: { src?: string; alt: string; locale: Locale }) {
  const [failed, setFailed] = useState<string>();
  return !src || failed === src
    ? <p role="img" aria-label={alt}>{locale === 'zh' ? '暂无可用示意图，请阅读动作说明。' : 'Image unavailable. Read the exercise instructions.'}</p>
    : <img src={src} alt={alt} width="280" height="200" loading="lazy" style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }} onError={() => setFailed(src)} />;
}
export function RepDBMedia({ exerciseId, exerciseName, locale, thumbnail = false }: { exerciseId: string; exerciseName: string; locale: Locale; thumbnail?: boolean }) {
  const metadata = catalogMetadata.get(exerciseId);
  if (!metadata) return null;
  const poses = (['start', 'peak', 'main'] as const).filter(pose => metadata.media[pose]);
  const selected = thumbnail ? poses.slice(0, 1) : poses;
  return <div className="repdb-media">
    {selected.length ? selected.map(pose => <figure key={pose} style={{ margin: 0 }}><CatalogImage src={metadata.media[pose]} alt={`${exerciseName} — ${locale === 'zh' ? { start: '起始姿势', peak: '动作姿势', main: '示意图' }[pose] : pose}`} locale={locale} /></figure>) : <CatalogImage alt={exerciseName} locale={locale} />}
    <RepDBAttribution />
  </div>;
}
