import { useEffect, useState } from 'react';
import { SegmentedTabs } from '../../components/kit';
import { DEFAULT_HOME_PANEL_STYLE, HOME_PANEL_STYLES, type HomePanelStyle } from '../../../domain/plan-upgrade';
import { homePanelStyle, setHomePanelStyle } from '../../../persistence/plan-upgrade-store';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { outlineShown, setOutlineShown } from '../plan-upgrade/prefs';

/** 我的 › 训练设置: 首页面板样式 (three styles, default 大数字) and 显示体型轮廓 (UIUX20261008 V9.14). */
export function PlanDisplaySettings({ locale }: { locale: 'zh' | 'en' }) {
  const c = planPagesCopy[locale];
  const [style, setStyle] = useState<HomePanelStyle>(DEFAULT_HOME_PANEL_STYLE);
  const [outline, setOutline] = useState(outlineShown);
  useEffect(() => { let alive = true; void homePanelStyle().then(value => { if (alive) setStyle(value); }).catch(() => undefined); return () => { alive = false; }; }, []);
  const choose = (value: string) => {
    const next = HOME_PANEL_STYLES.find(item => item === value);
    if (!next) return;
    const previous = style;
    setStyle(next);
    void setHomePanelStyle(next).catch(() => setStyle(previous));
  };
  return <>
    <li className="v9-row-block"><span className="v9-row-label">{c.panelStyle}</span>
      <SegmentedTabs label={c.panelStyle} value={style} onChange={choose} options={HOME_PANEL_STYLES.map(value => ({ value, label: c.panelStyles[value] }))}/></li>
    <li><label className="v9-row v9-row-check"><span>{c.showOutline}</span><input type="checkbox" checked={outline} onChange={event => { const value = event.target.checked; if (setOutlineShown(value)) setOutline(value); }}/></label></li>
  </>;
}
