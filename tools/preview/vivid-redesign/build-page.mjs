/**
 * Builds outputs/vivid-redesign/index.html (self-contained, no external scripts or fonts) from variants.json and
 * the screenshots in outputs/vivid-redesign/img. PNGs from capture.spec.ts are converted to WebP and removed.
 * Run after build-variants.mjs and the capture: node tools/preview/vivid-redesign/build-page.mjs
 */
import { readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const dir = join(root, 'outputs/vivid-redesign');
const img = join(dir, 'img');
for (const file of readdirSync(img).filter(f => f.endsWith('.png'))) {
  await sharp(join(img, file)).webp({ quality: 78, effort: 6 }).toFile(join(img, file.replace(/\.png$/, '.webp')));
  unlinkSync(join(img, file));
}
const variants = JSON.parse(readFileSync(join(dir, 'variants.json'), 'utf8'));
const screens = [['home', '今天'], ['month', '计划 · 月'], ['player', '训练中'], ['review', '回顾']];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const shots = (id, name) => `<div class="shots">${screens.map(([key, label]) =>
  `<figure><img src="img/${id}-${key}.webp" width="390" height="844" loading="lazy" alt="${esc(name)} · ${label}"><figcaption>${label}</figcaption></figure>`).join('')}</div>`;
const letter = id => id.slice(-1).toUpperCase();

const sections = variants.map(v => `
<section class="variant" id="${v.id}">
  <header class="vhead">
    <span class="tag">${letter(v.id)}</span>
    <div><h2>${esc(v.name)} <small>${esc(v.en)} · ${v.scheme === 'dark' ? '深色' : '浅色'}</small></h2><p>${esc(v.description)}</p></div>
  </header>
  <ul class="swatches" aria-label="主要颜色">${v.swatches.map(c => `<li><i style="background:${c}"></i><code>${c}</code></li>`).join('')}</ul>
  <details class="contrast"><summary>对比度（WCAG AA 要求正文 ≥ 4.5）</summary><ul>${v.contrast.map(c =>
    `<li><span class="pair" style="background:${c.bg};color:${c.fg}">字</span>${esc(c.label)} <b>${c.ratio}</b></li>`).join('')}</ul></details>
  ${shots(v.id, v.name)}
</section>`).join('');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>山野暖阳 · 四版重设计</title>
<style>
:root { --bg: #f6f6f4; --panel: #ffffff; --ink: #1d1d1b; --muted: #5d5d58; --line: #dcdcd6; --tag: #1d1d1b; --tag-ink: #ffffff; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg: #161615; --panel: #212120; --ink: #ededea; --muted: #a8a8a2; --line: #3a3a37; --tag: #ededea; --tag-ink: #161615; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
main { max-width: 1760px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.25; }
.intro { max-width: 760px; color: var(--muted); margin: 0 0 8px; }
.intro b { color: var(--ink); }
nav.jump { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 8px; }
nav.jump a { color: var(--ink); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; background: var(--panel); font-size: 14px; }
.variant { margin-top: 28px; padding: 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); }
.variant.current { border-style: dashed; }
.vhead { display: flex; gap: 14px; align-items: flex-start; }
.tag { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; background: var(--tag); color: var(--tag-ink); font-weight: 700; font-size: 18px; }
.vhead h2 { margin: 0; font-size: 22px; line-height: 1.3; }
.vhead small { font-size: 14px; font-weight: 400; color: var(--muted); margin-left: 6px; }
.vhead p { margin: 4px 0 0; color: var(--muted); }
.swatches { display: flex; flex-wrap: wrap; gap: 10px 16px; list-style: none; padding: 0; margin: 14px 0 6px; }
.swatches li { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
.swatches i { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--line); }
.contrast { margin: 6px 0 4px; font-size: 14px; color: var(--muted); }
.contrast summary { cursor: pointer; }
.contrast ul { display: flex; flex-wrap: wrap; gap: 8px 18px; list-style: none; padding: 0; margin: 8px 0 0; }
.contrast li { display: flex; align-items: center; gap: 6px; }
.contrast b { color: var(--ink); }
.pair { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 6px; font-weight: 700; border: 1px solid var(--line); }
.shots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
figure { margin: 0; min-width: 0; }
figure img { display: block; width: 100%; height: auto; border-radius: 18px; border: 1px solid var(--line); background: var(--bg); }
figcaption { margin-top: 6px; text-align: center; font-size: 14px; color: var(--muted); }
footer { margin-top: 32px; color: var(--muted); font-size: 14px; }
@media (max-width: 900px) { .shots { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .shots { grid-template-columns: 1fr; } .variant { padding: 14px; } h1 { font-size: 24px; } }
</style>
</head>
<body>
<main>
<h1>山野暖阳 · 四版重设计</h1>
<p class="intro">按 Bo 的意见重做“山野暖阳”：<b>木质版画</b>的刻线与浮雕（卡片有刻出的边、短而实的投影与高光），背景加<b>细木纹</b>（程序生成的原创纹理），<b>层次</b>拉开；月历里<b>今天</b>用墨色凸起的印章标出，<b>练完 / 练了一部分 / 计划 / 没练</b>分别是实心块 / 下半填色 / 描边 / 虚线；整体降低饱和度与亮度，去掉大面积暖色，减轻久看疲劳。</p>
<p class="intro">以下都是真实应用截图（390×844，同一份数据：10 月 12、14、16、19 日练完，18 日练了一部分，今天 10 月 20 日）。最上面是现在的版本，供对比。选定一版后再正式上线。</p>
<nav class="jump" aria-label="跳到"><a href="#current">现在</a>${variants.map(v => `<a href="#${v.id}">${letter(v.id)} · ${esc(v.name)}</a>`).join('')}</nav>
<section class="variant current" id="current">
  <header class="vhead"><span class="tag">现</span><div><h2>现在的山野暖阳 <small>对比用</small></h2><p>平面、偏亮的暖杏底；月历今天只有一圈看不见的描边，计划日没有标记。</p></div></header>
  ${shots('current', '现在的山野暖阳')}
</section>
${sections}
<footer>预览专用，不会出现在应用的“换风格”里。代码：src/themes/vivid-previews/（每版一个 CSS + 共用的浮雕层），生成脚本在 tools/preview/vivid-redesign/。</footer>
</main>
</body>
</html>
`;
writeFileSync(join(dir, 'index.html'), html);
const total = readdirSync(img).reduce((sum, f) => sum + statSync(join(img, f)).size, 0);
console.log(`index.html written; ${readdirSync(img).length} images, ${(total / 1024 / 1024).toFixed(2)} MB`);
