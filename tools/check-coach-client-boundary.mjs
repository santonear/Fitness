import { readdir, readFile } from 'node:fs/promises';

const directory = new URL('../dist/assets/', import.meta.url);
const files = (await readdir(directory)).filter(file => file.endsWith('.js'));
if (!files.length) throw new Error('Build production client assets first');
for (const file of files) {
  const source = await readFile(new URL(file, directory), 'utf8');
  for (const marker of [
    'fitness/system/safety',
    "You are Fitness's adult general-fitness planner",
    'MANAGE_PLAN: explain only',
  ]) {
    if (source.includes(marker)) throw new Error(`Backend prompt found in client asset ${file}`);
  }
  // Anything a reverse-engineering agent could lift from the bundle: keys, the AI supplier, server-only secrets.
  const leak =
    /sk-[A-Za-z0-9]{20,}|BEGIN [A-Z ]*PRIVATE KEY|deepseek|[A-Z_]*(?:SECRET|API_KEY)|x-admin-operation-id/i.exec(
      source,
    );
  if (leak) throw new Error(`Server-only value "${leak[0]}" found in client asset ${file}`);
}
console.log(`PASS: ${files.length} production JavaScript assets exclude backend prompts, keys and secrets`);
