/** Declarative V8 route inventory. */
export const v8Routes = [
  { id: 'onboarding', path: '/onboarding', page: 'onboarding/OnboardingPage', namespace: 'onboarding', owner: 'E' },
  { id: 'draft', path: '/plan-draft', page: 'onboarding/PlanDraftPage', namespace: 'onboarding', owner: 'E' },
  { id: 'next', path: '/', page: 'training/NextPage', namespace: 'training', owner: 'E' },
  { id: 'workout', path: '/workout/:id', page: 'training/WorkoutPage', namespace: 'training', owner: 'E' },
  { id: 'finish', path: '/workout/:id/finish', page: 'training/FinishPage', namespace: 'training', owner: 'E' },
  { id: 'activity', path: '/activity', page: 'training/ActivityPage', namespace: 'training', owner: 'E' },
  { id: 'plan', path: '/plans', page: 'plan/PlanPage', namespace: 'plan', owner: 'F' },
  { id: 'versions', path: '/plans/versions', page: 'plan/VersionsPage', namespace: 'plan', owner: 'F' },
  { id: 'exercises', path: '/exercises', page: 'plan/ExercisesPage', namespace: 'plan', owner: 'F' },
  { id: 'review', path: '/review', page: 'review/ReviewPage', namespace: 'review', owner: 'F' },
  { id: 'settings', path: '/settings', page: 'settings/SettingsPage', namespace: 'settings', owner: 'F' },
  { id: 'appearance', path: '/settings/appearance', page: 'settings/AppearancePage', namespace: 'settings', owner: 'F' },
  { id: 'templates', path: '/settings/templates', page: 'settings/TemplatesPage', namespace: 'settings', owner: 'F' },
  { id: 'admin', path: '/admin', page: 'ManagementPage', namespace: 'admin', owner: 'H' },
] as const;
export type V8RouteId = typeof v8Routes[number]['id'];
