import { PregnancySafetyControls } from './PregnancySafetyControls';
import { OlderFallPanel } from './OlderFallPanel';
import { PostpartumSafetyPanel } from './PostpartumSafetyPanel';
import { Button } from '../../components/common';
import { useWorkoutState } from './workout/useWorkoutState';
import { workoutModel } from './workout/workout-model';
import { workoutBody } from './workout/workout-body';
import { workoutScreen } from './workout/workout-screen';
import './player.css';

/** The workout player. State lives in useWorkoutState; the active screen is built by plain render functions. */
export function WorkoutPage() {
  const w = useWorkoutState();
  const { active, cardiacPanel, t, navigate, item, data } = w;
  if (!active)
    return (
      <main className="wk-page">
        {cardiacPanel}
        <OlderFallPanel />
        <PostpartumSafetyPanel />
        <PregnancySafetyControls />
        <p>{t.noTraining}</p>
        <Button onClick={() => navigate('/')}>{t.next}</Button>
      </main>
    );
  if (!item) return null;
  const m = workoutModel({ ...w, active, item, data: data! });
  const body = workoutBody(m);
  return workoutScreen(m, body);
}
