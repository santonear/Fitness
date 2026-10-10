export default {
title: 'My plan', versions: 'Plan versions', goal: 'Goal', rhythm: 'Rhythm',
    history: 'View previous versions', library: 'Exercise library', chat: 'Talk with Yaya about changes',
    back: 'Back', current: 'Current', readOnly: 'Read only', view: 'View plan',
    historyNote: 'Each change creates a new version. Completed workouts stay linked to the version used at the time.',
    version: (n: number) => `Version ${n}`, pace: (n: number) => `${n} times a week, at your own pace`,
    minutes: (n: number) => `${n} min`, sets: (n: number) => `${n} sets`,
    reps: (n: number) => `${n} reps`, seconds: (n: number) => `${n} sec`,
    kg: (n: number) => `${n} kg`, meters: (n: number) => `${n} m`,
    origins: { onboard: 'Created with Yaya', coach_change: 'Adjusted with Yaya', review_suggestion: 'Weekly suggestion adopted', manual: 'Manually adjusted', migrated: 'Kept from a previous plan' },
  };

