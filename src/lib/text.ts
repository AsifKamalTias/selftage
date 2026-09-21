/**
 * English pluralisation for the handful of nouns the UI counts. Regular enough that a
 * rule beats a dictionary; anything irregular passes its plural explicitly.
 */
export function pluralOf(word: string, count: number, plural?: string): string {
  if (count === 1) return word;
  if (plural) return plural;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/** "1 entry" / "3 entries" — the number and its noun, agreeing. */
export function countOf(count: number, word: string, plural?: string): string {
  return `${count} ${pluralOf(word, count, plural)}`;
}

/** Subject-verb agreement for a counted subject: "1 budget needs", "2 budgets need". */
export function verbFor(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
