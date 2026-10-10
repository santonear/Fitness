import type { CoachRequest } from './contracts';

/** Reject explicit contradictory count claims. This is not general semantic verification. */
export function reviewCountClaimsMatch(facts: Extract<CoachRequest,{task:'PERIOD_REVIEW'}>['facts'], text:string): boolean {
  const checks: [number,RegExp[]][] = [
    [facts.notStarted,[/(\d+)\s+(?:entries|sessions|workouts)(?:\s+(?:were\s+)?(?:recorded|marked))?(?:\s+as)?\s+not[ -]started/gi, /not[ -]started\s*(?:sessions|workouts|entries)?\s*(?:[:：]|was|were|is|are)?\s*(\d+)/gi, /未开始(?:的训练)?\s*(?:为|有|[:：])?\s*(\d+)\s*(?:次|条|天)/g, /(\d+)\s*(?:次|条|天)(?:\s*(?:训练|记录))?\s*(?:标记为|为)?未开始/g]],
    [facts.complete,[/(\d+)\s+completed\s*(?:sessions|workouts)?/gi, /(?:完整完成|已完成)(?:的?训练)?\s*(?:为|有|[:：])?\s*(\d+)\s*次/g]],
    [facts.partial,[/(\d+)\s+partial\s*(?:sessions|workouts)?/gi, /部分完成(?:的?训练)?\s*(?:为|有|[:：])?\s*(\d+)\s*次/g]],
    [facts.missingCount,[/(\d+)\s+(?:days|entries|records)(?:\s+(?:are|were|still))?\s+(?:missing|lacking)/gi, /(?:缺失的?记录|缺少记录)\s*(?:有|为|[:：])?\s*(\d+)\s*(?:条|天)/g]],
  ];
  return checks.every(([expected,patterns]) => patterns.every(pattern => [...text.matchAll(pattern)].every(match => Number(match[1]) === expected)));
}
