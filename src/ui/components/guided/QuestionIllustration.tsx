import type { GuidedQuestion } from './GuidedOnboarding';

const artwork: Record<GuidedQuestion | 'welcome', React.ReactNode> = {
  biologicalSex: <><circle cx="130" cy="78" r="30" fill="var(--fitness-yellow)" /><path d="M73 171c0-40 23-59 57-59s57 19 57 59M119 80q11 12 22 0" /><circle cx="120" cy="70" r="2" /><circle cx="140" cy="70" r="2" /></>,
  welcome: <><path d="M55 136C106 100 143 63 207 43" /><path d="m89 104 5-16 5 16 16 5-16 5-5 16-5-16-16-5Z" fill="#f5f0eb" /><circle cx="185" cy="64" r="3" /></>,
  age: <><circle cx="130" cy="103" r="58" /><circle cx="130" cy="103" r="43" /><circle cx="130" cy="103" r="27" /><path d="M130 103 169 68M130 103v-17" /><circle cx="130" cy="103" r="4" /></>,
  heightCm: <><circle cx="110" cy="57" r="14" /><path d="M110 75v64m-29-43 29-16 29 16m-29 43-18 30m18-30 18 30M180 37v132m-12-132h24m-24 132h24m-12-110h-10m10 22h-10m10 22h-10m10 22h-10m10 22h-10" /></>,
  weightKg: <><rect x="69" y="44" width="122" height="123" rx="2" /><path d="M90 91a40 40 0 0 1 80 0H90Z" /><path d="m130 90 17-25M101 132h58" /><circle cx="130" cy="90" r="3" /></>,
  waistCm: <><path d="M103 39c-5 25-22 31-12 60s-4 47-10 69m76-129c5 25 22 31 12 60s4 47 10 69" /><ellipse cx="130" cy="110" rx="52" ry="13" /><path d="M84 111v12m19-8v12m20-10v12m20-12v12m20-14v12" /></>,
  bodyFatPercent: <><path d="M131 38c-13 25-40 47-40 76a40 40 0 0 0 80 0c0-29-27-51-40-76Z" /><circle cx="117" cy="97" r="7" /><circle cx="144" cy="128" r="7" /><path d="m114 132 33-38" /></>,
  goal: <><path d="M49 165 105 90l24 33 34-67 47 109H49Z" /><path d="M163 56V30l35 10-35 11m-45 84 12-12m25-41 8-26" /></>,
  experience: <><path d="M61 165h47v-37h46V90h45V51M76 144v-22m55-21V79m47-17V40" /><circle cx="76" cy="104" r="10" /><path d="m64 126 12-9 12 9" /></>,
  location: <><path d="m53 96 62-49 62 49M67 87v75h98V87M101 162v-40h29v40M187 164V90m-20 20 20-43 20 43h-40m4 20 16-34 16 34h-32" /></>,
  equipment: <><path d="M82 83h96v40H82Z" /><rect x="61" y="64" width="21" height="79" rx="2" /><rect x="178" y="64" width="21" height="79" rx="2" /><path d="M48 84v39m164-39v39M106 96h48m-48 14h48" /></>,
  time: <><circle cx="130" cy="104" r="60" /><path d="M130 64v42l30 17m-30-79v8m0 104v8m-60-60h8m104 0h8" /><circle cx="130" cy="104" r="3" /></>,
  preferences: <><path d="M132 156c-23-20-64-48-64-77 0-32 41-45 64-15 23-30 64-17 64 15 0 29-41 57-64 77Z" /><path d="m104 104 18 18 34-38" /></>,
  safety: <><path d="m130 35 56 22v45c0 33-24 53-56 72-32-19-56-39-56-72V57l56-22Z" /><path d="m104 105 18 18 35-43" /></>,
};

export function QuestionIllustration({ question }: { question: GuidedQuestion | 'welcome' }) {
  return <div className={`guided-question-art art-${question}`} aria-hidden="true"><svg viewBox="0 0 260 210" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M54 107C45 52 91 24 146 31c63 7 79 64 52 112-21 38-99 42-126 11-10-12-15-28-18-47Z" fill="var(--fitness-orange-bg)" stroke="none" /><circle cx="187" cy="54" r="19" fill="var(--fitness-yellow)" stroke="none" />{artwork[question]}<path d="m56 51 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" fill="var(--fitness-orange)" stroke="none" /></svg></div>;
}
