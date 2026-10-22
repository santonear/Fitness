/**
 * Shared checks for free-text fields. Everything a person types is stored locally or bound as a
 * parameter, so code-like text is not dangerous to us; it is rejected because it is never a real
 * answer and could steer the coach model when the text is sent to it.
 */
export type TextIssue = 'tooLong' | 'code' | 'noise';

const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g;
const CODE: RegExp[] = [
  // SQL statements: a keyword alone is ordinary English ("delete squats from my plan"), so each rule needs SQL syntax too.
  /\bselect\s+(?:\*|distinct\b|count\s*\()/i,
  /\bselect\b[\s\S]{0,60}\bfrom\s+[\w."`[\]]+[\s\S]*?(?:\bwhere\b|\bjoin\b|\border\s+by\b|\blimit\s+\d|;|=)/i,
  /\binsert\s+into\s+[\w."`]+[\s\S]*\bvalues\s*\(/i,
  /\bupdate\s+[\w."`]+\s+set\s+[\w."`]+\s*=/i,
  /\bdelete\s+from\s+[\w."`]+\s*(?:;|\bwhere\b)/i,
  /\b(?:drop|truncate|alter|create)\s+(?:table|database|schema|view|index|trigger|procedure)\b/i,
  /\bunion\s+(?:all\s+)?select\b|\bexec(?:ute)?\s+(?:xp|sp)_\w+/i,
  /['"`]\s*(?:or|and)\s+['"`]?\w+['"`]?\s*=|\b(?:or|and)\s+\d+\s*=\s*\d+/i,
  /;\s*--|\/\*[\s\S]*?\*\//,
  // Markup and script.
  /<\s*\/?\s*(?:script|iframe|img|svg|style|object|embed|link|meta|form|input|body|html|a|div|span|p|b|i)\b[^>]*>/i,
  /\b(?:javascript|vbscript)\s*:|\bon(?:error|load|click|mouse\w+|focus|blur|key\w+|submit|change)\s*=/i,
  /\$\{[^}]*\}|\{\{[^}]*\}\}|<%[\s\S]*?%>|\$\([^)]*\)/,
  // Shell commands, path traversal and encoded payloads.
  /\b(?:rm\s+-rf|sudo\s+\w+|curl\s+https?:|wget\s+https?:|powershell\b|cmd(?:\.exe)?\s+\/c)|\b(?:eval|exec|require)\s*\(/i,
  /(?:\.\.\/){2,}|\/etc\/passwd|%(?:3c|3e|22|27|3b|00)/i,
  // Attempts to steer the coach model.
  /\bignore\s+(?:all\s+|the\s+)?(?:previous|above|prior)\s+(?:instructions|prompts?|rules)\b|忽略(?:之前|以上|上面|前面)的?(?:所有)?(?:指令|提示词?|规则|设定)|\bsystem\s*prompt\b|系统提示词/i,
];
const MEANINGFUL = /[\p{L}\p{N}\p{Extended_Pictographic}]/u;

/** Removes invisible control and direction characters and surrounding spaces. */
export const cleanText = (text: string) => text.replace(INVISIBLE, '').trim();

/** Returns why a free-text value cannot be saved, or undefined when it is fine (or empty). */
export function textIssue(text: string | undefined, max?: number): TextIssue | undefined {
  const value = cleanText(text ?? '');
  if (!value) return undefined;
  if (max !== undefined && value.length > max) return 'tooLong';
  if (CODE.some(pattern => pattern.test(value))) return 'code';
  if (!MEANINGFUL.test(value) || /(.)\1{9,}/u.test(value.replace(/\s+/g, ''))) return 'noise';
  return undefined;
}

/** Field limits used by both the screens and the server. */
export const TEXT_LIMITS = { name: 60, short: 80, note: 300, long: 500, chat: 1600 } as const;
