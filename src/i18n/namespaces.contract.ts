export const v8Namespaces = ['common', 'onboarding', 'training', 'plan', 'review', 'settings', 'coach', 'admin'] as const;
export type V8Namespace = typeof v8Namespaces[number];
/** Each feature owns features/<namespace>/zh.json and en.json; no shared mutable dictionary. */
export type V8Locale = 'zh' | 'en';
