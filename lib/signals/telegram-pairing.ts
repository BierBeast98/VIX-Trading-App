import { createHash, timingSafeEqual } from 'node:crypto';
export const PAIRING_ID = 'telegram_pairing_v1';
export type Pairing = { adminHash: string; startHash: string; expectedBot: string; issuedAt: string;
  expiresAt: string; status: 'pending' | 'connecting' | 'completed'; claimAt?: string; claimId?: string };
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function hasSecret(secret: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(expectedHash) || secret.length < 32 || secret.length > 128) return false;
  return timingSafeEqual(Buffer.from(hash(secret), 'hex'), Buffer.from(expectedHash, 'hex'));
}
export function privateChatForPairing(updates: unknown, pairing: Pairing): string | null {
  if (!Array.isArray(updates)) return null;
  const matches = new Set<string>();
  for (const update of updates) {
    const message = update?.message;
    if (message?.chat?.type !== 'private' || !Number.isSafeInteger(message.chat.id) || message.chat.id <= 0 || message.from?.id !== message.chat.id || message.from?.is_bot === true) continue;
    if (typeof message.text !== 'string' || !/^\/start [A-Za-z0-9_-]{32,64}$/.test(message.text)) continue;
    if (!Number.isFinite(message.date) || message.date * 1000 < Date.parse(pairing.issuedAt) - 60000 || message.date * 1000 > Date.parse(pairing.expiresAt)) continue;
    if (hasSecret(message.text.slice(7), pairing.startHash)) matches.add(String(message.chat.id));
  }
  if (matches.size > 1) throw new Error('Verbindungslink wurde von mehreren Chats geöffnet; bitte neue Verbindung starten');
  return matches.values().next().value ?? null;
}
