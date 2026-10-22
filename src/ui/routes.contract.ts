/** Declarative V8 route inventory. */
export const v8Routes = [
  {
    id: 'bodyProfile',
    path: '/settings/body',
    page: 'settings/BodyProfilePage',
    namespace: 'settings',
    owner: 'integration',
  },
  {
    id: 'nutrition',
    path: '/settings/nutrition',
    page: 'settings/NutritionPage',
    namespace: 'settings',
    owner: 'followup',
  },
  {
    id: 'activityImport',
    path: '/settings/import',
    page: 'settings/ActivityImportPage',
    namespace: 'settings',
    owner: 'followup',
  },
  { id: 'onboarding', path: '/onboarding', page: 'onboarding/OnboardingPage', namespace: 'onboarding', owner: 'E' },
  { id: 'draft', path: '/plan-draft', page: 'onboarding/PlanDraftPage', namespace: 'onboarding', owner: 'E' },
  { id: 'next', path: '/', page: 'home/HomePage', namespace: 'training', owner: 'E' },
  { id: 'focus', path: '/today-focus', page: 'plan-upgrade/FocusPage', namespace: 'training', owner: 'plan-upgrade' },
  { id: 'journey', path: '/journey', page: 'settings/SettingsPage', namespace: 'settings', owner: 'plan-upgrade' }, // 我的山路 removed (Bo 2026-10-22); old links open 我的.
  { id: 'calm', path: '/calm', page: 'plan-upgrade/CalmPage', namespace: 'coach', owner: 'plan-upgrade' },
  { id: 'workout', path: '/workout/:id', page: 'training/WorkoutPage', namespace: 'training', owner: 'E' },
  { id: 'finish', path: '/workout/:id/finish', page: 'training/FinishPage', namespace: 'training', owner: 'E' },
  { id: 'activity', path: '/activity', page: 'training/ActivityPage', namespace: 'training', owner: 'E' },
  { id: 'plan', path: '/plans', page: 'plan/PlanPage', namespace: 'plan', owner: 'F' },
  { id: 'versions', path: '/plans/versions', page: 'plan/VersionsPage', namespace: 'plan', owner: 'F' },
  { id: 'exercises', path: '/exercises', page: 'plan/ExercisesPage', namespace: 'plan', owner: 'F' },
  { id: 'review', path: '/review', page: 'review/ReviewPage', namespace: 'review', owner: 'F' },
  { id: 'settings', path: '/settings', page: 'settings/SettingsPage', namespace: 'settings', owner: 'F' },
  {
    id: 'appearance',
    path: '/settings/appearance',
    page: 'settings/AppearancePage',
    namespace: 'settings',
    owner: 'F',
  },
  { id: 'templates', path: '/settings/templates', page: 'settings/TemplatesPage', namespace: 'settings', owner: 'F' },
  { id: 'admin', path: '/admin', page: 'ManagementPage', namespace: 'admin', owner: 'H' },
] as const;
export type V8RouteId = (typeof v8Routes)[number]['id'];
