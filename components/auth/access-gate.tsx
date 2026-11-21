'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import useSWR from 'swr';

export function AccessGate({ children }: { children: ReactNode }) {
  const { data, error, mutate } = useSWR('/api/auth/status', async (url: string) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (response.status === 401) throw new Error('unauthorized');
    if (!response.ok) throw new Error('unavailable');
    return response.json();
  }, { shouldRetryOnError: false, revalidateOnFocus: true });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/signals/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (response.status === 429) throw new Error('Zu viele Anmeldeversuche. Bitte versuche es später erneut.');
      if (response.status === 503) throw new Error('Anmeldung vorübergehend nicht verfügbar. Bitte versuche es später erneut.');
      if (!response.ok) throw new Error('E-Mail oder Passwort ungültig oder Zugang nicht eingerichtet.');
      setPassword('');
      await mutate();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen.');
    } finally { setBusy(false); }
  }

  if (data && error?.message !== 'unauthorized') return children;
  if (!error) return <main className="grid min-h-[100dvh] place-items-center text-sm text-[#8B8FA8]" role="status">Zugang wird geprüft …</main>;
  if (error.message !== 'unauthorized') return <main className="grid min-h-[100dvh] place-items-center px-5"><section className="w-full max-w-sm rounded-2xl border border-[#2E2E3A] bg-[#15151D] p-6"><p role="alert" className="text-white">Die Verbindung zum Dashboard ist fehlgeschlagen.</p><button onClick={() => void mutate()} className="mt-4 rounded-xl bg-[#B8E15A] px-4 py-2 font-semibold text-black">Erneut versuchen</button></section></main>;
  return <main className="grid min-h-[100dvh] place-items-center px-5"><section className="w-full max-w-sm rounded-2xl border border-[#2E2E3A] bg-[#15151D] p-6"><h1 className="text-2xl font-semibold text-white">VIX Trading</h1><p className="mt-2 text-sm text-[#B3B6C8]">Melde dich mit deiner E-Mail-Adresse und deinem Passwort an.</p><form onSubmit={unlock} className="mt-6 space-y-4"><label htmlFor="login-email" className="block text-sm text-white">E-Mail-Adresse</label><input id="login-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-xl border border-[#3B3B48] bg-[#1A1A22] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#B8E15A]"/><label htmlFor="login-password" className="block text-sm text-white">Passwort</label><input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-[#3B3B48] bg-[#1A1A22] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#B8E15A]"/><button disabled={busy} className="w-full rounded-xl bg-[#B8E15A] px-4 py-3 font-semibold text-black disabled:opacity-60">{busy ? 'Anmeldung …' : 'Anmelden'}</button>{message && <p role="alert" className="text-sm text-red-300">{message}</p>}</form></section></main>;
}
