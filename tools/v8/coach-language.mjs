import ts from 'typescript';
import { checkCoachLanguage } from '../../src/application/rules/coach-language.ts';

// Scan authored prose, not source operators, comments, user input, or error messages.
export function isCoachCopySource(file) {
  return /^(src\/(coach|application\/(review|rules)|i18n\/features)\/|src\/ui\/(onboarding|training|plan|review|coach)\/|src\/ui\/.*(Coach|Review)|src\/backend\/.*(coach|eval|prompt)|tests\/(backend|fixtures)\/.*(coach|eval|prompt))/i.test(file)
    && !/(contracts|schemas|coach-language)(\.test)?\.[cm]?[jt]s$/.test(file);
}
function exempt(node) {
  if (ts.isJsxText(node) && /^[\s\p{Symbol}\p{Punctuation}]+$/u.test(node.text) && ts.isJsxElement(node.parent)) {
    const opening = node.parent.openingElement;
    if (opening.tagName.getText() === 'button' && opening.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText() === 'aria-label')) return true;
  }
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isPropertyAssignment(p) || ts.isVariableDeclaration(p)) {
      const key = p.name.getText().replace(/['"]/g, '');
      if (/^(errors?|errorMessage|failureMessage|input|request|userInput|userText|adversarialInput)$/i.test(key)) return true;
    }
    if (ts.isNewExpression(p) && p.expression.getText() === 'Error') return true;
  }
  return false;
}
export function coachCopyViolations(file, source) {
  if (!isCoachCopySource(file)) return [];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.json') ? ts.ScriptKind.JSON : file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = new Set();
  function staticText(node) {
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const a = staticText(node.left), b = staticText(node.right);
      if (a !== undefined && b !== undefined) return a + b;
    }
  }
  function visit(node) {
    const combined = ts.isBinaryExpression(node) ? staticText(node) : undefined;
    if (combined !== undefined && !exempt(node)) for (const rule of checkCoachLanguage(combined)) found.add(`coach-language-${rule}`);
    if ((ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) && !exempt(node)) {
      for (const rule of checkCoachLanguage(node.text)) found.add(`coach-language-${rule}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return [...found];
}
