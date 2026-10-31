import { useEffect, useRef, useState, type ReactNode } from 'react';
import models from '../../catalog/exercise-3d.json';
import type { Locale } from '../../domain/models';
import { ChoiceChip } from './kit';
import { figureSex } from '../pages/plan-upgrade/logic';
import { lastFigureSex } from '../pages/plan-upgrade/prefs';
import { useOptionalMainline } from '../mainline/context';
import type { MotionView } from './motion-view';

type Model = { target: number[]; male: string; female: string };
const byId: Record<string, Model> = models;

/** The accepted 3D motion of an exercise; the static picture stays until it is ready, and if it fails. */
export function Exercise3D({ id, locale, fallback }: { id: string; locale: Locale; fallback: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    view = useRef<MotionView>(undefined);
  const biologicalSex = useOptionalMainline()?.data?.profile?.bodyDetails?.values?.biologicalSex;
  const file = byId[id]![figureSex(biologicalSex, lastFigureSex())];
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    let alive = true;
    setState('loading');
    import('./motion-view')
      .then(m => m.mountMotion(canvas.current!, `/models/${file}`, byId[id]!.target))
      .then(
        v => (alive ? ((view.current = v), setState('ready')) : v.dispose()),
        () => alive && setState('failed'),
      );
    return () => {
      alive = false;
      view.current?.dispose();
      view.current = undefined;
    };
  }, [id, file]);
  const zh = locale === 'zh';
  return (
    <figure className="exercise-3d">
      <canvas
        ref={canvas}
        hidden={state !== 'ready'}
        aria-label={zh ? '动作 3D 演示，可拖动旋转、双指缩放' : '3D exercise demo: drag to rotate, pinch to zoom'}
      />
      {state !== 'ready' && fallback}
      {state === 'ready' && (
        <figcaption>
          <ChoiceChip
            size="sm"
            selected={!playing}
            onClick={() => {
              view.current?.setPlaying(!playing);
              setPlaying(!playing);
            }}
          >
            {playing ? (zh ? '暂停' : 'Pause') : zh ? '播放' : 'Play'}
          </ChoiceChip>
          <small>
            {zh
              ? '肌肉模型改编自 Z-Anatomy 与 BodyParts3D（CC BY-SA 4.0）'
              : 'Muscle model adapted from Z-Anatomy and BodyParts3D (CC BY-SA 4.0)'}
          </small>
        </figcaption>
      )}
    </figure>
  );
}
