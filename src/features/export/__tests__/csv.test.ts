import { describe, expect, it } from '@jest/globals';

import { escapeHtml, toCsv } from '../csv';

describe('toCsv', () => {
  it('quotes cells containing separators, quotes or newlines', () => {
    expect(toCsv([['a,b', 'say "hi"', 'line\nbreak', 3, null]])).toBe(
      '"a,b","say ""hi""","line\nbreak",3,'
    );
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    expect(toCsv([['=SUM(A1)', '-2+3', '@cmd', 'plain']])).toBe("'=SUM(A1),'-2+3,'@cmd,plain");
  });

  it('keeps numeric values intact, including negative amounts', () => {
    expect(toCsv([[-5, '-5.00', '+3']])).toBe('-5,-5.00,+3');
  });

  it('joins rows with CRLF', () => {
    expect(toCsv([['a'], ['b']])).toBe('a\r\nb');
  });
});

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<b class="x">Tom & 'Jerry'</b>`)).toBe(
      '&lt;b class=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/b&gt;'
    );
  });
});
