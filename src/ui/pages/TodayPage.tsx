import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { liveQuery } from 'dexie';
import { workoutService } from '../../application/workouts';
import { WorkoutPage } from './WorkoutPage';

export function TodayPage() {
  const { i18n } = useTranslation();
  const zh = i18n.resolvedLanguage === 'zh';
  const [ongoing, setOngoing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const subscription = liveQuery(() => workoutService.getActiveWorkout()).subscribe({
      next: session => {
        setOngoing(Boolean(session));
        setError('');
      },
      error: reason => setError((reason as Error).message),
    });
    return () => subscription.unsubscribe();
  }, []);
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {ongoing && <p><Link to="/workout">{zh ? '继续训练' : 'Continue workout'}</Link></p>}
      <WorkoutPage />
      <p><Link to="/progress">{zh ? '查看历史与进度' : 'View history and progress'}</Link></p>
    </>
  );
}
