import { Suspense, lazy, useState, type ComponentProps } from 'react';

// The guide text and exercise data are large; they download the first time a guide is shown.
export const loadExerciseGuide = () => import('./ExerciseGuide');
const Panel = lazy(() => loadExerciseGuide().then(module => ({ default: module.ExerciseGuidePanel })));
const Content = lazy(() => loadExerciseGuide().then(module => ({ default: module.ExerciseGuideContent })));

/** ExerciseGuidePanel that loads on first open and stays mounted afterwards (so closing still animates). */
export function ExerciseGuidePanel(props: ComponentProps<typeof Panel>) {
  const [shown, setShown] = useState(props.open);
  if (props.open && !shown) setShown(true);
  return shown ? (
    <Suspense fallback={null}>
      <Panel {...props} />
    </Suspense>
  ) : null;
}

export function ExerciseGuideContent(props: ComponentProps<typeof Content>) {
  return (
    <Suspense fallback={null}>
      <Content {...props} />
    </Suspense>
  );
}
