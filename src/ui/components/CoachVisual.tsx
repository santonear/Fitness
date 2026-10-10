export type CoachVisualState = 'idle' | 'thinking' | 'replying' | 'success';
import './coach-panel.css';

const images = { idle: 0, thinking: 1, replying: 2, success: 3 };
/** Exact embedded V8 reference images; state mapping matches its setAvatar calls. */
export function CoachVisual({ state = 'idle' }: { state?: CoachVisualState }) {
  return <img className="coach-visual" data-state={state} src={`/coach/prototype-${images[state]}.png`} alt="" />;
}
