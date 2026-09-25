export function exactColumn(header: string[], name: string): number {
  const matches = header.flatMap((h, i) => h.trim() === name.trim() ? [i] : []);
  if (!name.trim() || matches.length !== 1) throw new Error(`Coluna ausente ou ambígua: ${name}`);
  return matches[0];
}

// Do not guess dd/mm versus mm/dd or substitute synchronization time.
export function submittedAt(raw: string, offset: string): string {
  if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(offset)) throw new Error('Configure GOOGLE_FORM_TIMEZONE_OFFSET');
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error('Data ausente ou inválida; esperado dd/mm/aaaa hh:mm:ss');
  const [, day, month, year, hour, minute, second = '00'] = match;
  const local = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}`;
  const check = new Date(`${local}Z`);
  if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 19) !== local) throw new Error('Data inválida');
  return new Date(`${local}${offset}`).toISOString();
}

export function rowPayload(header: string[], row: string[]): Record<string, string> {
  const keys = header.map(h => h.trim());
  if (keys.some(h => !h) || new Set(keys).size !== keys.length) throw new Error('Cabeçalhos vazios ou repetidos');
  return Object.fromEntries(keys.map((h, i) => [h, String(row[i] ?? '')]));
}

export async function evidenceKey(sheet: string, tab: string, payload: Record<string, string>): Promise<string> {
  const canonical = JSON.stringify([sheet, tab, Object.entries(payload).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
