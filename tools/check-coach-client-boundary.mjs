import { readdir, readFile } from 'node:fs/promises';

const directory = new URL('../dist/assets/', import.meta.url);
const files = (await readdir(directory)).filter(file => file.endsWith('.js'));
if (!files.length) throw new Error('Build production client assets first');
for (const file of files) {
  const source = await readFile(new URL(file, directory), 'utf8');
  for (const marker of ['fitness/system/safety', "You are Fitness's adult general-fitness planner", 'MANAGE_PLAN: explain only']) {
    if (source.includes(marker)) throw new Error(`Backend prompt found in client asset ${file}`);
  }
}
console.log(`PASS: ${files.length} production JavaScript assets exclude backend coach prompts`);
