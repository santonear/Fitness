import { lazy, Suspense } from 'react';
import type { LetterDialogProps } from './LetterPaper';

// The letter, its ornaments and handwriting fonts load only when a letter is shown (first load stays unchanged).
const Lazy = lazy(() => import('./LetterPaper'));
export function LetterDialog(props: LetterDialogProps) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
