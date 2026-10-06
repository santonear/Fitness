const paths = {
  today: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  plans: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M7 3v4 M17 3v4 M3 11h18 M7 15h2 M13 15h4',
  exercises: 'M6 7v10 M3 9v6 M6 12h12 M18 7v10 M21 9v6',
  progress: 'M3 3v18h18 M7 16l4-5 4 2 5-7',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  load: 'M5 20V10 M12 20V4 M19 20v-7',
} as const;

export function NavigationIcon({ name }: { name: keyof typeof paths }) {
  return <span className="app-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg></span>;
}
