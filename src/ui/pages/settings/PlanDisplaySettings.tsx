import { useState } from 'react';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { outlineShown, setOutlineShown } from '../plan-upgrade/prefs';

/** 我的 › 训练设置: 显示体型轮廓 (UIUX20261008 V9.14). The home panel style is switched on 今天's panel itself. */
export function PlanDisplaySettings({ locale }: { locale: 'zh' | 'en' }) {
  const c = planPagesCopy[locale];
  const [outline, setOutline] = useState(outlineShown);
  return (
    <li>
      <label className="v9-row v9-row-check">
        <span>{c.showOutline}</span>
        <input
          type="checkbox"
          checked={outline}
          onChange={event => {
            const value = event.target.checked;
            if (setOutlineShown(value)) setOutline(value);
          }}
        />
      </label>
    </li>
  );
}
