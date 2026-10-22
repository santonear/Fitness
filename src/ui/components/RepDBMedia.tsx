import { useState, type ReactNode } from 'react';
import { exerciseOriginalMedia, exerciseVisualMetadata, type PoseMedia } from '../../catalog/exercise-visual';
import type { Locale } from '../../domain/models';
import { RepDBAttribution } from './RepDBAttribution';

export function CatalogImage({ src, alt, locale }: { src?: string; alt: string; locale: Locale }) {
  const [failed, setFailed] = useState<string>();
  return !src || failed === src ? (
    <p role="img" aria-label={alt}>
      {locale === 'zh' ? '暂无可用示意图，请阅读动作说明。' : 'Image unavailable. Read the exercise instructions.'}
    </p>
  ) : (
    <img
      src={src}
      alt={alt}
      width="280"
      height="200"
      loading="lazy"
      style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }}
      onError={() => setFailed(src)}
    />
  );
}
function PoseImages({
  media,
  exerciseName,
  locale,
  thumbnail,
  attribution,
}: {
  media: PoseMedia;
  exerciseName: string;
  locale: Locale;
  thumbnail: boolean;
  attribution: ReactNode;
}) {
  const poses = (['start', 'peak', 'main'] as const).filter(pose => media[pose]);
  const selected = thumbnail ? poses.slice(0, 1) : poses;
  return (
    <div className="repdb-media">
      {selected.length ? (
        selected.map(pose => (
          <figure key={pose} style={{ margin: 0 }}>
            <CatalogImage
              src={media[pose]}
              alt={`${exerciseName} — ${locale === 'zh' ? { start: '起始姿势', peak: '动作姿势', main: '示意图' }[pose] : pose}`}
              locale={locale}
            />
          </figure>
        ))
      ) : (
        <CatalogImage alt={exerciseName} locale={locale} />
      )}
      {attribution}
    </div>
  );
}
export function RepDBMedia({
  exerciseId,
  exerciseName,
  locale,
  thumbnail = false,
}: {
  exerciseId: string;
  exerciseName: string;
  locale: Locale;
  thumbnail?: boolean;
}) {
  const metadata = exerciseVisualMetadata(exerciseId);
  return metadata ? (
    <PoseImages
      media={metadata.media}
      exerciseName={exerciseName}
      locale={locale}
      thumbnail={thumbnail}
      attribution={<RepDBAttribution />}
    />
  ) : null;
}
/** Fitness-original pose illustrations; never credited to a provider. */
export function OriginalMedia({
  exerciseId,
  exerciseName,
  locale,
  thumbnail = false,
}: {
  exerciseId: string;
  exerciseName: string;
  locale: Locale;
  thumbnail?: boolean;
}) {
  const media = exerciseOriginalMedia(exerciseId);
  return media ? (
    <PoseImages
      media={media}
      exerciseName={exerciseName}
      locale={locale}
      thumbnail={thumbnail}
      attribution={
        <small className="original-attribution">
          {locale === 'zh' ? 'Fitness 原创示意图' : 'Fitness original illustration'}
        </small>
      }
    />
  ) : null;
}
