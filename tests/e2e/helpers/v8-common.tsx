import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Chip, IconButton, Link, Row, Segmented, Sheet, Stat, Toggle } from '../../../src/ui/components/common';
import '../../../src/ui/theme.css';
import './v8-common.css';

document.documentElement.dataset.theme = new URLSearchParams(location.search).get('theme') ?? 'qingci';
function Gallery() {
  const [count, setCount] = useState(0), [selected, setSelected] = useState(false), [checked, setChecked] = useState(false), [period, setPeriod] = useState('week');
  return <main><h1>训练，按自己的节奏</h1><Sheet>
    <Stat label="本周已练" value="2" description="每一次都算数" />
    <Row>下一次 · 全身训练</Row>
    <Button variant="primary" workout onClick={() => setCount(count + 1)}>开始训练</Button>
    <Button onClick={() => setCount(count + 1)}>查看计划</Button>
    <Button disabled onClick={() => setCount(count + 1)}>不可用</Button>
    <IconButton aria-label="设置">⚙</IconButton>
    <Chip selected={selected} onClick={() => setSelected(!selected)}>哑铃</Chip>
    <Link href="#details">训练详情</Link>
    <Toggle checked={checked} onCheckedChange={setChecked}>训练提醒</Toggle>
    <Segmented label="回顾时段" value={period} onChange={setPeriod} options={[{ value: 'week', label: '本周' }, { value: 'month', label: '本月' }]} />
    <output aria-label="操作次数">{count}</output><p id="details">保持自己的节奏。</p>
  </Sheet></main>;
}
createRoot(document.getElementById('root')!).render(<Gallery />);
