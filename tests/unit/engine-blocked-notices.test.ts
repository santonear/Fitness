import { describe, expect, it } from 'vitest';
import { engineDisplayNotices } from '../../src/application/engine-presentation';
import { engineCopy } from '../../src/coach/engine-copy';
import type { EngineNotice, GateResult } from '../../src/engine/contracts';

describe('blocked-plan presentation', () => {
  it('shows only the blocking reason, not course guidance', () => {
    const key = 'pregnancy.gate.copy.ask_provider';
    const notices: EngineNotice[] = [
      {
        code: key,
        copyPath: key,
        ruleId: 'pregnancy.gate',
        severity: 'stop',
        message: { zh: engineCopy(key, 'zh')!, en: engineCopy(key, 'en')! },
      },
      {
        code: 'course-only',
        ruleId: 'duration',
        severity: 'warning',
        message: { zh: '课程提示', en: 'Course notice' },
      },
    ];
    const gates = [{ status: 'blocked', ruleId: 'pregnancy.gate', noticeCode: key }] as GateResult[];
    expect(engineDisplayNotices({ notices, gates }).map(row => row.code)).toEqual([key]);
  });
  it('does not retain a former blocker after answers pass', () => {
    expect(engineDisplayNotices({ gates: [], notices: [] })).toEqual([]);
  });
});
