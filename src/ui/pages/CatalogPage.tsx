import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExerciseMedia } from '../components/ExerciseMedia';
import { searchExercises } from '../../catalog/catalog-service';
import { EXERCISE_IDS } from '../../catalog/exercise-ids';
import { getExerciseMedia } from '../../catalog/media';
import type { CatalogFilters, Locale } from '../../domain/models';

const favoriteKey = 'fitness-exercise-favorites-v1';
const knownIds = new Set<string>(Object.values(EXERCISE_IDS));
const muscleTags: Record<string, 'legs' | 'core' | 'cardio'> = {
  [EXERCISE_IDS.gobletSquat]: 'legs', [EXERCISE_IDS.bodyweightSquat]: 'legs',
  [EXERCISE_IDS.plank]: 'core', [EXERCISE_IDS.walking]: 'cardio',
};
function readFavorites(): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(favoriteKey) ?? '[]');
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && knownIds.has(id)))] : [];
  } catch { return []; }
}
export function CatalogPage() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.resolvedLanguage === 'zh' ? 'zh' : 'en';
  const tr = (zh: string, en: string) => locale === 'zh' ? zh : en;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CatalogFilters['category']>();
  const [equipment, setEquipment] = useState<CatalogFilters['equipment']>();
  const [muscle, setMuscle] = useState('');
  const [favorites, setFavorites] = useState(readFavorites);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  useEffect(() => { const refresh = (event: StorageEvent) => { if (event.key === favoriteKey || event.key === null) setFavorites(readFavorites()); };
    window.addEventListener('storage', refresh); return () => window.removeEventListener('storage', refresh);
  }, []);
  function toggleFavorite(id: string) {
    const stored = readFavorites(); const next = stored.includes(id) ? stored.filter(value => value !== id) : [...stored, id];
    try { localStorage.setItem(favoriteKey, JSON.stringify(next)); setFavorites(next); setStorageError(''); }
    catch { setStorageError(tr('浏览器未允许保存收藏，请检查本地存储权限。', 'The browser could not save favorites. Check local storage permissions.')); }
  }
  const results = searchExercises(query, locale, { category, equipment }).filter(exercise =>
    (!muscle || muscleTags[exercise.id] === muscle) && (!favoriteOnly || favorites.includes(exercise.id)));
  const muscleName = (key: string) => ({ legs: tr('腿部', 'Legs'), core: tr('核心', 'Core'), cardio: tr('有氧', 'Cardio') })[key] ?? key;
  const equipmentChoices = [...new Set(searchExercises('', locale, {}).map(exercise => exercise.equipment))];
  return <div className="v31-catalog">
    <header className="v31-section-head"><div><p className="v31-eyebrow">MOVEMENT LIBRARY</p><h1>{tr('每个动作，找到正确的开始方式', 'Find your starting point for every movement')}</h1><p>{tr('动作、器械、记录类型清晰可查。步骤与注意事项帮助理解，不能代替现场指导。', 'Explore movements, equipment and recording types. Instructions help you understand an exercise; they do not replace in-person guidance.')}</p></div></header>
    <div className="v31-catalog-filters">
      <label>{t('catalogSearch')}<input type="search" placeholder={tr('搜索动作名称…', 'Search exercise names…')} value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>{tr('肌群 / 类型', 'Muscle / movement')}<select aria-label={tr('肌群 / 类型', 'Muscle / movement')} value={muscle} onChange={event => setMuscle(event.target.value)}><option value="">{tr('全部肌群', 'All muscle groups')}</option>{['legs', 'core', 'cardio'].map(key => <option key={key} value={key}>{muscleName(key)}</option>)}</select></label>
      <label>{tr('器械', 'Equipment')}<select aria-label={tr('器械', 'Equipment')} value={equipment ?? ''} onChange={event => setEquipment(event.target.value as CatalogFilters['equipment'] || undefined)}><option value="">{tr('全部器械', 'All equipment')}</option>{equipmentChoices.map(key => <option key={key} value={key}>{t('equipment_' + key)}</option>)}</select></label>
      <label>{t('catalogCategory')}<select aria-label={t('catalogCategory')} value={category ?? ''} onChange={event => setCategory(event.target.value as CatalogFilters['category'] || undefined)}><option value="">{t('catalogAll')}</option>{(['strength', 'cardio', 'bodyweight'] as const).map(key => <option key={key} value={key}>{t(key)}</option>)}</select></label>
    </div>
    <div className="v31-content-toolbar"><label className="v31-checkbox"><input type="checkbox" checked={favoriteOnly} onChange={event => setFavoriteOnly(event.target.checked)} />{tr('只看已收藏', 'Favorites only')}</label><span role="status" className="v31-badge">{results.length} {tr('个动作', 'exercises')}</span><small>{tr('收藏保存在此浏览器，不包含在训练 JSON 备份中；恢复训练数据不会清除收藏。', 'Favorites stay in this browser, outside training JSON backups. Restoring training data keeps favorites.')}</small></div>
    {storageError && <p role="alert">{storageError}</p>}
    {results.length === 0 && <section className="v31-empty"><h2>{t('catalogNoResults')}</h2><p>{tr('试试其他名称或减少筛选条件。', 'Try another name or fewer filters.')}</p><button onClick={() => { setQuery(''); setCategory(undefined); setEquipment(undefined); setMuscle(''); setFavoriteOnly(false); }}>{tr('清除筛选', 'Clear filters')}</button></section>}
    <div className="v31-exercise-grid">{results.map(exercise => {
      const isOpen = expanded.includes(exercise.id); const media = getExerciseMedia(exercise.id);
      return <article key={exercise.id} className="v31-exercise-card">
        <div className="v31-exercise-art">{media && <img src={media.illustration} alt="" width="280" height="160" loading="lazy" />}<button className="v31-favorite" aria-label={tr('收藏', 'Favorite') + ' ' + exercise.name[locale]} aria-pressed={favorites.includes(exercise.id)} onClick={() => toggleFavorite(exercise.id)}>{favorites.includes(exercise.id) ? '★' : '☆'}</button></div>
        <div className="v31-exercise-content"><div className="v31-tags"><span className="v31-badge">{muscleName(muscleTags[exercise.id])}</span><span className="v31-badge">{t('equipment_' + exercise.equipment)}</span></div><h2>{exercise.name[locale]}</h2><p>{t('metric_' + exercise.metricType)}</p><p>{exercise.steps[locale][0]}</p>
          <button aria-expanded={isOpen} aria-controls={'exercise-' + exercise.id} onClick={() => setExpanded(current => isOpen ? current.filter(id => id !== exercise.id) : [...current, exercise.id])}>{isOpen ? tr('收起详情', 'Hide details') : tr('查看动作详情', 'View exercise details')}</button>
          {isOpen && <section id={'exercise-' + exercise.id} className="v31-exercise-detail"><h3>{tr('动作步骤', 'Steps')}</h3><ol>{exercise.steps[locale].map(step => <li key={step}>{step}</li>)}</ol><h3>{tr('注意事项', 'Cautions')}</h3>{exercise.cautions[locale].map(caution => <p key={caution}>{caution}</p>)}<ExerciseMedia exerciseId={exercise.id} exerciseName={exercise.name[locale]} locale={locale} /></section>}
        </div>
      </article>;
    })}</div>
    <p className="v31-footnote">{tr('只展示受控动作目录。肌群标签用于查找，不表示针对任何人群的医学适用性。示意图为项目原创，动作姿势尚未经专业审核。', 'Only the controlled exercise catalog is shown. Muscle tags support browsing, not medical suitability. Illustrations are original; movement form has not been professionally reviewed.')}</p>
  </div>;
}
