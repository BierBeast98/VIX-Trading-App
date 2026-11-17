/** Agent/operator helper. No bot token is read locally. Ephemeral admin secret stays in a 0600 file. */
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [action, target] = process.argv.slice(2);
if (action === 'prepare') {
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}bot$/i.test(target ?? '')) throw new Error('Bot username required');
  process.loadEnvFile('.env');
  const db = new PrismaClient();
  try {
    const admin = randomBytes(32).toString('base64url'), start = randomBytes(24).toString('base64url');
    const hash = s => createHash('sha256').update(s).digest('hex');
    const issuedAt = new Date().toISOString(), expiresAt = new Date(Date.now() + 30 * 60000).toISOString();
    const data = { adminHash: hash(admin), startHash: hash(start), expectedBot: target, issuedAt, expiresAt, status: 'pending' };
    await db.vixCache.upsert({ where: { id: 'telegram_pairing_v1' }, create: { id: 'telegram_pairing_v1', data }, update: { data } });
    const folder = await mkdtemp(join(tmpdir(), 'vix-telegram-')); await chmod(folder, 0o700);
    const file = join(folder, 'pairing.json');
    await writeFile(file, JSON.stringify({ admin, expiresAt }), { mode: 0o600 });
    console.log(JSON.stringify({ credentialsFile: file, link: `https://t.me/${target}?start=${start}`, expiresAt }));
  } finally { await db.$disconnect(); }
} else if (action === 'complete') {
  const setup = JSON.parse(await readFile(target, 'utf8'));
  if (Date.parse(setup.expiresAt) <= Date.now()) throw new Error('Pairing expired');
  const response = await fetch('https://vix-trading.de/api/telegram/connect', { method: 'POST', headers: { Authorization: `Bearer ${setup.admin}` }, signal: AbortSignal.timeout(45000) });
  const body = await response.json().catch(() => ({ error: 'Endpoint not available; deployment required' }));
  console.log(JSON.stringify({ status: response.status, ...body }));
} else throw new Error('Use prepare <bot_username> or complete <credentials_file>');
