import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type Appearance = 'atlas' | 'serene' | 'orbit';
const key = 'fitness-appearance-v31';
const valid = (value: unknown): value is Appearance => ['atlas', 'serene', 'orbit'].includes(String(value));
const Context = createContext<{ theme: Appearance; change: (theme: Appearance) => void }>({ theme: 'atlas', change: () => {} });
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Appearance>(() => { try { const value = localStorage.getItem(key); return valid(value) ? value : 'atlas'; } catch { return 'atlas'; } });
  useEffect(() => { document.documentElement.dataset.appearance = theme; }, [theme]);
  useEffect(() => { const sync = (event: StorageEvent) => { if (event.key === key && valid(event.newValue)) setTheme(event.newValue); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  function change(next: Appearance) { setTheme(next); try { localStorage.setItem(key, next); } catch { /* The current appearance remains usable when persistence is unavailable. */ } }
  return <Context.Provider value={{ theme, change }}>{children}</Context.Provider>;
}
export const useAppearance = () => useContext(Context);
export function AppearanceCards() {
  const { theme, change } = useAppearance(); const { i18n } = useTranslation(); const zh = i18n.resolvedLanguage === 'zh';
  return <section className="v31-appearance"><h2>{zh ? '外观与版式' : 'Appearance & layout'}</h2><p>{zh ? '切换全站布局，当前页面、草稿和正在进行的训练保持不变。外观偏好保存在此浏览器，不包含在训练备份中。' : 'Change the app layout while keeping this page, drafts and active workout. Appearance is a browser preference outside training backups.'}</p><div className="theme-choice-grid">{(['atlas', 'serene', 'orbit'] as const).map((name, index) => <button key={name} className="theme-choice" aria-pressed={name === theme} onClick={() => change(name)}><span className={`theme-preview ${name}`} aria-hidden="true"><i /><b /><em /></span><strong>{name[0].toUpperCase() + name.slice(1)}</strong><small>{(zh ? ['专业、清晰、信息密度高', '温和、舒展、注重恢复体验', '活泼、友好、轻量激励'] : ['Focused, clear and compact', 'Calm, spacious and restorative', 'Friendly, expressive and light'])[index]}</small><span>{name === theme ? (zh ? '正在使用' : 'Selected') : (zh ? '使用此版式' : 'Use this layout')}</span></button>)}</div></section>;
}
