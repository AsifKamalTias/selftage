const NUMERIC = /^[-+]?\d+(\.\d+)?$/;
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Serializes rows to RFC 4180 CSV. Text cells that could be read as formulas are
 * prefixed with an apostrophe to prevent CSV injection; plain numbers are left intact.
 */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell == null) return '';
          let text = String(cell);
          if (typeof cell === 'string' && !NUMERIC.test(text) && FORMULA_START.test(text)) {
            text = `'${text}`;
          }
          return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(',')
    )
    .join('\r\n');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
