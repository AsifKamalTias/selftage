import type { Transaction } from '@/db/types';
import type { Currency } from '@/features/settings/currencies';
import type { LedgerStatement } from '@/features/ledger/repository';
import { formatDate, type DateFormat } from '@/lib/date';
import { formatMoney } from '@/lib/money';

import { escapeHtml, toCsv } from './csv';

interface ReportContext {
  currency: Currency;
  dateFormat: DateFormat;
  rangeText: string;
  hasStart: boolean;
}

const plain = (minor: number) => (minor / 100).toFixed(2);

export function ledgerCsv(statements: LedgerStatement[], ctx: ReportContext): string {
  const rows: (string | number | null)[][] = [
    ['Account', 'Date', 'Description', 'Type', 'Source', 'Debit', 'Credit', 'Balance'],
  ];
  for (const s of statements) {
    if (ctx.hasStart) {
      rows.push([
        s.accountName,
        '',
        'Balance brought forward',
        '',
        '',
        '',
        '',
        plain(s.summary.openingBalance),
      ]);
    }
    for (const e of s.entries) {
      rows.push([
        s.accountId ? s.accountName : e.accountName,
        e.date,
        e.description,
        e.categoryName ?? (e.entryType === 'opening' ? 'Opening balance' : ''),
        e.sourceName ?? '',
        e.debit ? plain(e.debit) : '',
        e.credit ? plain(e.credit) : '',
        plain(e.balance),
      ]);
    }
    rows.push([
      s.accountName,
      '',
      'Totals / closing balance',
      '',
      '',
      plain(s.summary.totalDebit),
      plain(s.summary.totalCredit),
      plain(s.summary.closingBalance),
    ]);
  }
  return toCsv(rows);
}

export function transactionsCsv(items: Transaction[]): string {
  return toCsv([
    ['Date', 'Kind', 'Title', 'Type', 'Source', 'Account', 'Amount', 'Note', 'Attachments'],
    ...items.map((t) => [
      t.date,
      t.kind,
      t.title,
      t.categoryName,
      t.sourceName ?? '',
      t.accountName,
      plain(t.amount),
      t.note ?? '',
      t.attachmentCount,
    ]),
  ]);
}

export function ledgerHtml(statements: LedgerStatement[], ctx: ReportContext): string {
  const money = (minor: number) => escapeHtml(formatMoney(minor, ctx.currency));
  const date = (iso: string) => escapeHtml(formatDate(iso, ctx.dateFormat));

  const sections = statements
    .map((s) => {
      const body = s.entries
        .map(
          (e) => `<tr>
            <td>${e.entryType === 'opening' ? 'Opening' : date(e.date)}</td>
            <td>${escapeHtml(e.description)}<div class="muted">${escapeHtml(
              [e.categoryName, e.sourceName, s.accountId ? null : e.accountName]
                .filter(Boolean)
                .join(' · ')
            )}</div></td>
            <td class="num in">${e.debit ? money(e.debit) : ''}</td>
            <td class="num out">${e.credit ? money(e.credit) : ''}</td>
            <td class="num">${money(e.balance)}</td>
          </tr>`
        )
        .join('');
      const opening = ctx.hasStart
        ? `<tr class="sub"><td></td><td>Balance brought forward</td><td></td><td></td><td class="num">${money(
            s.summary.openingBalance
          )}</td></tr>`
        : '';
      return `<section>
        <h2>${escapeHtml(s.accountName)}</h2>
        <div class="cards">
          ${ctx.hasStart ? `<div><span>Opening</span><b>${money(s.summary.openingBalance)}</b></div>` : ''}
          <div><span>Debit (in)</span><b class="in">${money(s.summary.totalDebit)}</b></div>
          <div><span>Credit (out)</span><b class="out">${money(s.summary.totalCredit)}</b></div>
          <div><span>Closing</span><b>${money(s.summary.closingBalance)}</b></div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Description</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
          <tbody>${opening}${body || '<tr><td colspan="5" class="muted center">No entries in this period</td></tr>'}</tbody>
          <tfoot><tr><td></td><td>Totals · closing balance</td><td class="num">${money(
            s.summary.totalDebit
          )}</td><td class="num">${money(s.summary.totalCredit)}</td><td class="num">${money(
            s.summary.closingBalance
          )}</td></tr></tfoot>
        </table>
      </section>`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ledger report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, Inter, Arial, sans-serif; color: #0f172a; margin: 32px; font-size: 12px; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 22px; color: #4f46e5; }
    h2 { font-size: 15px; margin: 24px 0 8px; }
    .muted { color: #64748b; font-size: 10px; }
    .center { text-align: center; padding: 16px; }
    .cards { display: flex; gap: 8px; margin-bottom: 10px; }
    .cards div { flex: 1; background: #f4f5fa; border-radius: 8px; padding: 8px 10px; }
    .cards span { display: block; color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; }
    .cards b { font-size: 13px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; background: #eef0f6; padding: 6px 8px; }
    td { padding: 6px 8px; border-bottom: 1px solid #e3e6ee; vertical-align: top; }
    tr.sub td { background: #fafbff; font-style: italic; }
    tfoot td { font-weight: 700; border-top: 2px solid #0f172a; border-bottom: none; }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .in { color: #059669; } .out { color: #e11d48; }
    section { page-break-inside: auto; }
    footer { margin-top: 24px; color: #94a3b8; font-size: 9px; text-align: center; }
  </style></head>
  <body>
    <header>
      <div><h1>Ledger report</h1><div class="muted">${escapeHtml(ctx.rangeText)} · ${escapeHtml(
        ctx.currency.code
      )}</div></div>
      <div class="muted">Generated ${escapeHtml(new Date().toLocaleString())}</div>
    </header>
    ${sections}
    <footer>Selftage · Personal income &amp; expense tracker</footer>
  </body></html>`;
}
