/** Node 24: node tools/eval/compare-assistant-v2.ts <v2.1.0-report.json> <v3.0.0-report.json> */
import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { compareAssistantPromptVersions, type EvaluationResult } from './assistant-v2-metrics';

if (process.argv.length !== 4) throw Error('TWO_REPORT_PATHS_REQUIRED');
const root = resolve('.cache/assistant-v2-eval');
async function readReport(path: string): Promise<EvaluationResult[]> {
  const full = resolve(path),
    rel = relative(root, full);
  if (rel.startsWith('..') || isAbsolute(rel) || !rel.endsWith('.json')) throw Error('REPORT_MUST_BE_LOCAL_EVAL_JSON');
  const parsed = JSON.parse(await readFile(full, 'utf8'));
  if (!Array.isArray(parsed.records)) throw Error('INVALID_EVAL_REPORT');
  return parsed.records;
}
const records = [...(await readReport(process.argv[2])), ...(await readReport(process.argv[3]))];
const comparison = compareAssistantPromptVersions(records);
if (!comparison.sharedScenarios) throw Error('NO_SHARED_SCENARIOS_OR_PROMPT_VERSION_MISSING');
console.log(JSON.stringify(comparison, null, 2));
