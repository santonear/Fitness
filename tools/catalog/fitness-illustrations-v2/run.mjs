// Generates every pose in poses.json with Codex image generation, matching ref.png's woman and style.
// Peaks wait for their start image and attach it too, so props and framing stay consistent.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const poses = JSON.parse(fs.readFileSync(path.join(here, 'poses.json'), 'utf8'));
const out = path.join(here, 'out');
const done = name => fs.existsSync(path.join(out, name + '.png'));
const style = 'Use your image generation tool to create ONE new image. Match the attached reference image EXACTLY: the same adult woman (same face, dark ponytail, sage-green short-sleeve T-shirt, charcoal leggings, grey running shoes), the same semi-realistic hand-painted illustration style and soft lighting, the same plain warm off-white background with only a faint floor shadow, full body visible with some margin, square 1:1 canvas, no text, no labels, no arrows, no logos, no watermark. Props, if any, are simple and neutral (light-wood chair, plain off-white wall, grey mat, light-blue band). New pose: ';
const run = (name) => new Promise(resolve => {
  const imgs = ['ref.png'];
  if (name.endsWith('-peak') && done(name.replace(/-peak$/, '-start'))) imgs.push(path.join('out', name.replace(/-peak$/, '-start') + '.png'));
  const extra = imgs.length > 1 ? ' The second attached image shows the starting position of this same exercise: keep the same camera angle, framing, props and scale, and change only the pose.' : '';
  const prompt = style + poses[name] + extra + ' Do not run any shell commands; just generate the image and print the saved file path.';
  const args = ['exec', '--skip-git-repo-check', '-s', 'read-only', '--enable', 'image_generation', '--ephemeral', ...imgs.flatMap(i => ['-i', i]), '-'];
  const p = spawn('codex', args, { cwd: here, shell: true });
  let log = '';
  p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d);
  p.stdin.end(prompt);
  const timer = setTimeout(() => p.kill(), 9 * 60_000);
  p.on('close', () => {
    clearTimeout(timer);
    const home = path.join(process.env.USERPROFILE, '.codex');
    const files = [...log.matchAll(/generated_images[\\/][^\s`'"]+\.png/g)].map(m => path.join(home, m[0]));
    const file = files.find(f => fs.existsSync(f));
    if (file) { fs.copyFileSync(file, path.join(out, name + '.png')); console.log('ok', name); }
    else { console.log('FAIL', name, log.slice(-300).replace(/\s+/g, ' ')); }
    resolve();
  });
});
const names = Object.keys(poses).filter(n => !done(n));
const starts = names.filter(n => !n.endsWith('-peak')), peaks = names.filter(n => n.endsWith('-peak'));
async function pool(list, n) { const q = [...list]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) await run(q.shift()); })); }
await pool(starts, 4);
await pool(peaks, 4);
console.log('missing', Object.keys(poses).filter(n => !done(n)).join(' ') || 'none');
