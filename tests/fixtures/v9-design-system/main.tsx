import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, useTheme } from '../../../src/themes/ThemeProvider';
import { getThemeSlots, themes } from '../../../src/themes/registry';
import { BigChoice, Card, ChoiceChip, CountdownRing, Orb, PrimaryButton, ProgressRing, Scene, SegmentedTabs, StatTile, ThemePicker, WeekStrip, Yaya, yayaPoses } from '../../../src/ui/components/kit';
import '../../../src/ui/theme.css';
import '../../../src/ui/shared.css';
import './gallery.css';

/** V9 design-system gallery: every primitive, slot and mascot in the active theme. */
function Gallery() {
  const { theme, change } = useTheme();
  const slots = getThemeSlots(theme);
  const [training, setTraining] = useState(false);
  const [action, setAction] = useState('');
  const [goal, setGoal] = useState('lose');
  const [week, setWeek] = useState('1');
  const params = new URLSearchParams(location.search);
  const section = params.get('section');
  return <main className="v9-gallery" data-training-active={training}>
    <header><select aria-label="主题" value={theme} onChange={event => change(event.target.value)}>{themes.map(item => <option key={item.id} value={item.id}>{item.name.zh}</option>)}</select>
      <button type="button" onClick={() => setTraining(!training)}>训练状态</button><output>{action}</output></header>
    {(!section || section === 'home') && <section aria-label="首页示例" className="v9-gallery-stack">
      <slots.BrandMark label="芽芽陪练" />
      <slots.FeatureCard context="next" motionReduced={false} trainingActive={training}>
        <slots.StartHero name="全身力量" templateId="a" nextLabel="今天的训练" estimatedMinutes={32} startLabel="开始训练" onStart={() => setAction('开始')} />
      </slots.FeatureCard>
      <div className="v9-gallery-grid"><Card><StatTile label="本周完成" value="0/3" progress={0.03} /></Card><Card><StatTile label="上周分钟" value="63" progress={0.68} /></Card></div>
      <Card><WeekStrip label="本周每天" variant="bars" days={['一', '二', '三', '四', '五', '六', '日'].map((d, i) => ({ key: d, label: d, state: [0, 2, 4].includes(i) ? 'planned' : 'rest', today: i === 0, level: [0, 2, 4].includes(i) ? 0.7 : 0 }))} /></Card>
      <slots.AiLine>上次深蹲你觉得“刚好”，今天每组多 2 次。</slots.AiLine>
      <slots.WeekProgress complete={1} partial={1} target={3} label="本周已练 1 次" />
    </section>}
    {(!section || section === 'kit') && <section aria-label="组件" className="v9-gallery-stack">
      <SegmentedTabs label="周次" value={week} onChange={setWeek} options={[{ value: '1', label: '第 1 周' }, { value: '2', label: '第 2 周' }, { value: '3', label: '第 3 周' }]} />
      <div className="v9-gallery-row">{['瘦一点', '更有力气', '身体更健康'].map((label, i) => <ChoiceChip key={label} selected={i === 0}>{label}</ChoiceChip>)}</div>
      <div role="radiogroup" aria-label="训练目标" className="v9-gallery-stack">{[['lose', '减脂', '有氧 + 力量'], ['gain', '增肌', '每组 8–12 次']].map(([value, label, description]) =>
        <BigChoice key={value} selected={goal === value} label={label} description={description} onClick={() => setGoal(value)} />)}</div>
      <div className="v9-gallery-row"><CountdownRing remaining={42} total={60} caption="保持" label="剩余时间" size={160} /><ProgressRing value={0.66} size={96} tone={3} label="连续坚持" /></div>
      <slots.SetValue label="修改本组" loadText="20 kg" targetText="8" onEdit={() => setAction('修改')} />
      <slots.RestClock elapsedSeconds={125} label="已歇" />
      <slots.Suggestions label="你也许想说" options={[{ id: 'a', label: '今天想轻松一点' }, { id: 'b', label: '换个动作' }]} onSelect={setAction} />
      <div className="v9-gallery-row">{(['training', 'plan', 'review', 'me'] as const).map(kind => <slots.NavIcon key={kind} kind={kind} selected={kind === 'training'} label={kind} />)}</div>
      <PrimaryButton onClick={() => setAction('主按钮')}>就用这个计划</PrimaryButton>
      <PrimaryButton tone="quiet">问问芽芽怎么改</PrimaryButton>
      <PrimaryButton tone="text">今天情况不一样？跟芽芽说</PrimaryButton>
    </section>}
    {(!section || section === 'mascot') && <section aria-label="芽芽" className="v9-gallery-stack">
      <div className="v9-gallery-row">{yayaPoses.map(pose => <Yaya key={pose} pose={pose} size={96} />)}</div>
      <div className="v9-gallery-row">{yayaPoses.map(pose => <Yaya key={pose} pose={pose} size={56} />)}</div>
      <div className="v9-gallery-scene"><Scene variant="dawn" /></div>
      <ThemePicker themes={themes} value={theme} onChange={change} locale="zh" label="界面风格" />
    </section>}
    <Orb context="home" onOpenChat={() => setAction('打开对话')} onAction={prompt => setAction(`快捷：${prompt}`)} autoTuck={params.get('tuck') === '1'} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<ThemeProvider><Gallery /></ThemeProvider>);
