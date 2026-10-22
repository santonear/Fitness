/**
 * One CSV row (RFC 4180, CRLF-terminated) for admin exports. Every cell is quoted, and a cell that a
 * spreadsheet could run as a formula (=, +, -, @, also after leading spaces or control characters) is
 * prefixed with ' so it stays text.
 */
export function csvRow(row: readonly unknown[]): string {
  return (
    row
      .map(value => {
        const text = String(value ?? '');
        const safe = /^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text;
        return '"' + safe.replaceAll('"', '""') + '"';
      })
      .join(',') + '\r\n'
  );
}
