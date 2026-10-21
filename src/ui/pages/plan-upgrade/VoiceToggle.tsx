import { useState } from 'react';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { setVoiceOn, voiceOn } from './prefs';
import { useLocalVoices, useVoiceCue } from './voice';

/** Training page: voice cues through on-device voices only (off by default). Disabled when the device has none. */
export function VoiceToggle({ locale, cue }: { locale: 'zh' | 'en'; cue?: string }) {
  const c = planPagesCopy[locale];
  const voices = useLocalVoices(locale);
  const [on, setOn] = useState(voiceOn);
  const available = voices.length > 0;
  useVoiceCue(cue, on && available, voices);
  return <label className="wk-voice" title={available ? c.voiceHint : c.voiceUnavailable}>
    <input type="checkbox" checked={on && available} disabled={!available} onChange={event => { const value = event.target.checked; if (setVoiceOn(value)) setOn(value); }}/>
    <span>{c.voice}</span>
  </label>;
}
