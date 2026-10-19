// Line icons from the approved V9 admin design; stroke follows the text color.
const paths={
 home:'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z',
 inbox:'M4 13l2.5-7h11L20 13M4 13v6h16v-6M4 13h5l1 2h4l1-2h5',
 users:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M17 3.5a4 4 0 0 1 0 7.5M22 21c0-3-1.6-5-4.5-5.7',
 chart:'M4 20V10M10 20V4M16 20v-7M22 20H2',
 sprout:'M12 21V11M12 11C12 6 15 3 20 3c0 5-3 8-8 8zM12 13C12 9 9.5 7 5 7c0 4 2.5 6 7 6z',
 toggle:'M8 6h8a6 6 0 0 1 0 12H8A6 6 0 0 1 8 6zM16 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
 alert:'M12 3l10 18H2L12 3zM12 10v5M12 18v.5',
 log:'M7 3h10l4 4v14H7zM11 11h6M11 15h6M3 7v14h4',
 gear:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
 refresh:'M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4',
 menu:'M4 7h16M4 12h16M4 17h16',
 close:'M6 6l12 12M18 6L6 18',
 message:'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
} as const;
export type AdminIconName=keyof typeof paths;
export function AdminIcon({name}:{name:AdminIconName}){return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>}
