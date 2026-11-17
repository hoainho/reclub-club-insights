/** The assessment's clock, deliberately independent of the machine clock. */
export const FIXED_NOW = '2026-10-05T02:00:00.000Z';
export const DEFAULT_FROM = '2026-09-07';
export const DEFAULT_TO = '2026-10-04';

export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function localDate(instant: string, timeZone: string): string {
  const pieces = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const value = (kind: string) => pieces.find(p => p.type === kind)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function monday(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}
export function comparisonRange(from: string, to: string) {
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  return { from, to, previousFrom: addDays(from, -days), previousTo: addDays(from, -1) };
}
export class InputError extends Error {}
export function parseInsightsQuery(params: URLSearchParams) {
  const clubId = params.get('clubId')?.trim();
  const from = params.get('from') ?? DEFAULT_FROM;
  const to = params.get('to') ?? DEFAULT_TO;
  if (!clubId || clubId.length > 128) throw new InputError('Choose a valid club.');
  if (!isDate(from) || !isDate(to)) throw new InputError('Dates must be valid YYYY-MM-DD values.');
  // Bound the calendar before deriving the previous period, keeping ISO dates four-digit.
  if (from < '1900-01-01' || to > '2100-12-31') throw new InputError('Choose dates between 1900 and 2100.');
  if (from > to) throw new InputError('The start date must be on or before the end date.');
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 730) throw new InputError('Choose a date range of at most 731 days.');
  return { clubId, from, to };
}
