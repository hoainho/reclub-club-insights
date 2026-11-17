/** RFC 4180-style CSV parser: escaped quotes, quoted commas and line breaks. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(value); if (row.some(cell => cell !== '')) rows.push(row);
      row = []; value = '';
    } else value += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (value !== '' || row.length) { row.push(value); rows.push(row); }
  const headers = rows.shift();
  if (!headers?.length) throw new Error('CSV has no header.');
  if (new Set(headers).size !== headers.length) throw new Error('CSV has duplicate headers.');
  return rows.map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`CSV row ${index + 2} has ${cells.length} columns; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, i) => [header, cells[i].trim()]));
  });
}
export function csvBoolean(value: string, nullable = false): number | null {
  if (nullable && value === '') return null;
  if (value.toLowerCase() === 'true' || value === '1') return 1;
  if (value.toLowerCase() === 'false' || value === '0') return 0;
  throw new Error(`Invalid boolean: ${JSON.stringify(value)}`);
}
