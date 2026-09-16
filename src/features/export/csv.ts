/** Serializes rows to RFC 4180 CSV. Cells that look like formulas are prefixed to prevent CSV injection. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell == null) return '';
          let text = String(cell);
          if (typeof cell === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
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
