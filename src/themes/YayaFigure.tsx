import type { CSSProperties } from 'react';
import type { BuiltinThemeId, YayaPose } from './contract';
import './yaya.css';

export type { YayaPose };
export const yayaPoses: readonly YayaPose[] = ['front', 'head', 'wave', 'cheer', 'think', 'thanks', 'care', 'celebrate', 'side', 'back'];
/** Head crops (width, left, top in %) that let a small disc show the pose instead of the plain head (Yaya.dc.html). */
const crops: Partial<Record<YayaPose, readonly [number, number, number]>> = {
  wave: [93.9, 0.4, -4.2], cheer: [88.6, 5.7, -3.1], think: [88.7, 5.7, -1.7],
  thanks: [88.9, 5.5, -3.4], care: [89.9, 4.6, -3.1], celebrate: [88.9, 5.5, -2.7],
};
/** Full figures need at least this many pixels; smaller sizes switch to the head disc. */
export const yayaFullMin = 110;

export function yayaSource(pose: YayaPose, mascot: BuiltinThemeId) { return `/yaya/${pose}-${mascot}.webp`; }

export interface YayaFigureProps {
  pose?: YayaPose;
  /** Rendered square size in CSS pixels. */
  size?: number;
  /** `auto` follows the design: full figure from 110px, head disc below. */
  mode?: 'auto' | 'full' | 'disc';
  /** Accessible name; pass an empty string when adjacent text already names 芽芽. */
  alt?: string;
  /** Gentle float for full figures; always off under reduced motion and during training. */
  float?: boolean;
  className?: string;
}

/** 芽芽 mascot in one costume: full figure or head disc, token-driven ring and glow. Knows nothing about the theme registry. */
export function YayaFigure({ mascot, pose = 'front', size = 240, mode = 'auto', alt = '芽芽', float = true, className }: YayaFigureProps & { mascot: BuiltinThemeId }) {
  const full = mode === 'full' || (mode === 'auto' && size >= yayaFullMin);
  const crop = crops[pose];
  const source = yayaSource(full ? pose : crop ? pose : 'head', mascot);
  const style = { '--yaya-size': `${size}px` } as CSSProperties;
  const image = full
    ? <img className="v9-yaya-full" data-float={float ? 'on' : 'off'} src={source} alt={alt} decoding="async" draggable={false} />
    : <span className="v9-yaya-disc"><img className="v9-yaya-head" src={source} alt={alt} decoding="async" draggable={false}
      style={!full && crop ? { width: `${crop[0]}%`, left: `${crop[1]}%`, top: `${crop[2]}%`, transform: 'none' } : undefined} /></span>;
  return <span className={['v9-yaya', className].filter(Boolean).join(' ')} data-pose={pose} data-mode={full ? 'full' : 'disc'} data-mascot={mascot} style={style}>{image}</span>;
}
