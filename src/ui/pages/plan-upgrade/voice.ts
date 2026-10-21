import { useEffect, useState } from 'react';
import { localVoices } from './logic';

/** On-device voices for this language; empty when the browser has none (then voice cues stay off). */
export function useLocalVoices(locale: 'zh' | 'en') {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const update = () => setVoices(localVoices(speechSynthesis.getVoices(), locale));
    update();
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, [locale]);
  return voices;
}

/** Speaks a short cue through an on-device voice only; never a network voice. */
export function useVoiceCue(text: string | undefined, enabled: boolean, voices: readonly SpeechSynthesisVoice[]) {
  useEffect(() => {
    const voice = voices[0];
    if (!enabled || !text || !voice || typeof speechSynthesis === 'undefined') return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }, [text, enabled, voices]);
  useEffect(() => () => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); }, []);
}
