'use client';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { BellRing, Check, ChevronDown, LockKeyhole, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { type State, type Config, type Signal, roundMetrics, marketOpen } from '@/lib/signals/engine';
type Payload = State & { dataFeed?: { provider: string; keyConfigured: boolean; entryPolicy?: 'realtime' | 'delayed20'; maxVixAgeMinutes?: number; productMaxAgeMinutes?: number }; capitalManaged?: boolean; channels: { email: boolean; telegram: boolean; links: boolean }; error?: string; configured?: boolean };
const euro = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const time = (s: string) => new Date(s).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
const panel = 'rounded-2xl border border-[#1E1E28] bg-[#141418] p-5';
async function request(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Anfrage fehlgeschlagen');
  return data;
}
type SignalWithFeed = Signal & { vixAt?: string | null; vixSource?: string | null; vixFeedMode?: string | null; vixAgeMinutes?: number | null };
function SignalCard({ signal, onDone }: { signal: SignalWithFeed; onDone: () => void }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [quantity, setQuantity] = useState(String(signal.quantity)), [price, setPrice] = useState(''), [fees, setFees] = useState('');
  const [at, setAt] = useState(''), [note, setNote] = useState('');
  const buy = signal.side === 'buy';
  const expired = buy && Date.parse(signal.expiresAt) < Date.now();
  const canRecord = signal.status !== 'executed';
  const status = ({ pending: expired ? 'Abgelaufen' : 'Bestätigung offen', executed: 'Ausgeführt', skipped: 'Nicht ausgeführt', expired: 'Abgelaufen', superseded: 'Durch neueres Signal ersetzt' })[signal.status];
  async function submit(action: 'execute' | 'skip') {
    setBusy(true); setError('');
    try {
      if (action === 'execute' && (!at || !price || fees === '')) throw new Error('Tatsächlichen Kurs, Gebühren (auch 0) und Ausführungszeit eintragen');
      await request('/api/signals/confirm', 'POST', { signalId: signal.id, action,
        ...(action === 'execute' ? { quantity: Number(quantity), price: Number(price), fees: Number(fees), at: new Date(at).toISOString(), note } : {}) });
      setOpen(false); onDone();
    } catch (e) { setError(e instanceof Error ? e.message : 'Fehler'); } finally { setBusy(false); }
  }
  return <article id={signal.id} className={`${panel} scroll-mt-20`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className={`rounded-lg px-3 py-1 text-xs font-bold ${buy ? 'bg-[#B8E15A]/10 text-[#B8E15A]' : 'bg-red-500/10 text-red-400'}`}>{buy ? 'KAUFEN' : 'VERKAUFEN'}</span>
      <span className="text-xs text-[#8B8FA8]">{status} · {time(signal.at)}</span>
    </div>
    <h3 className="mt-4 text-lg font-semibold text-white">{signal.reason}</h3>
    <p className="mt-1 font-mono text-sm text-[#8B8FA8]">{signal.isin}</p>
    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div><p className="text-xs text-[#8B8FA8]">{buy ? 'Zusätzlicher Einsatz bis' : 'Signal-Stückzahl'}</p><p className="mt-1 text-xl font-semibold text-white">{buy ? euro(signal.budget) : `${signal.quantity} Stück`}</p></div>
      <div><p className="text-xs text-[#8B8FA8]">{buy ? 'Zielquote gesamt' : 'Rundenbudget'}</p><p className="mt-1 text-xl text-white">{buy ? `${signal.targetPct} %` : euro(signal.capital)}</p></div>
      <div><p className="text-xs text-[#8B8FA8]">{buy ? 'Briefkurs bei Signal' : 'Geldkurs bei Signal'}</p><p className="mt-1 text-xl text-white">{euro(signal.price)}</p></div>
      <div><p className="text-xs text-[#8B8FA8]">{buy ? 'Stückzahl vor Gebühren' : 'Signalwert'}</p><p className="mt-1 text-xl text-white">{buy ? `${signal.quantity} Stück` : euro(signal.quantity * signal.price)}</p></div>
    </div>
    <p className="mt-4 text-xs leading-relaxed text-[#8B8FA8]">Kursstand {time(signal.quoteAt)}. {buy ? `Rundenbudget ${euro(signal.capital)}. Kauf gültig bis ${time(signal.expiresAt)}; Stückzahl um Brokergebühren anpassen.` : 'Verkaufssignal bleibt bis zur Erfassung offen; aktuellen Kurs vor der Order prüfen.'}</p>
    {buy && <p className="mt-2 text-xs leading-relaxed text-[#8B8FA8]">VIX bei Signal: Quelle {signal.vixSource ?? 'nicht aufgezeichnet'} · Kurszeit {signal.vixAt && Number.isFinite(Date.parse(signal.vixAt)) ? time(signal.vixAt) : 'nicht aufgezeichnet'} · Alter {typeof signal.vixAgeMinutes === 'number' && Number.isFinite(signal.vixAgeMinutes) ? `${signal.vixAgeMinutes.toFixed(1)} Min.` : 'nicht aufgezeichnet'}{signal.vixFeedMode ? ` · ${signal.vixFeedMode === 'delayed' ? 'verzögert' : signal.vixFeedMode === 'realtime' ? 'Echtzeitfeed' : 'Feedmodus unbekannt'}` : ''}</p>}
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#8B8FA8]">{(['telegram', 'email'] as const).map(c => <span key={c}>{c === 'email' ? 'E-Mail' : 'Telegram'}: {signal.notification[c]?.error ?? (signal.notification[c]?.sentAt ? `zugestellt ${time(signal.notification[c]!.sentAt!)}` : 'noch nicht zugestellt')}</span>)}</div>
    {canRecord && <div className="mt-5 border-t border-[#1E1E28] pt-4">
      <p className="mb-3 text-sm text-[#8B8FA8]">Trade ausgeführt? Schicke den Screenshot im Chat. Alternativ hier selbst erfassen.</p>
      {expired && <p className="mb-3 text-sm text-amber-300">Dieses Kaufsignal ist nicht mehr aktuell. Nur eine bereits erfolgte Ausführung nachtragen.</p>}
      <Button onClick={() => setOpen(!open)}><Check size={16} />Ausführung erfassen<ChevronDown size={14} /></Button>
      {signal.status === 'pending' && <Button className="ml-2" variant="ghost" loading={busy} onClick={() => submit('skip')}>Nicht ausgeführt</Button>}
      {open && <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void submit('execute'); }}>
        <Input label="Tatsächliche Stückzahl" type="number" min="1" step="1" required value={quantity} onChange={e => setQuantity(e.target.value)} />
        <Input label="Ausführungskurs in EUR" type="number" min="0.000001" step="any" required value={price} onChange={e => setPrice(e.target.value)} />
        <Input label="Gebühren gesamt in EUR" type="number" min="0" step="any" required value={fees} onChange={e => setFees(e.target.value)} />
        <Input label="Ausgeführt am (Gerätezeit)" type="datetime-local" required value={at} onChange={e => setAt(e.target.value)} />
        <div className="sm:col-span-2"><Textarea label="Notiz / Beleg" value={note} onChange={e => setNote(e.target.value)} placeholder="z. B. Brokerabrechnung / Screenshot, Ordernummer" /></div>
        <p className="text-xs text-[#8B8FA8] sm:col-span-2">Bei mehreren Teilausführungen: gesamte ausgeführte Stückzahl, gewichteter Durchschnittskurs und gesamte Gebühren eintragen. Eine Bestätigung pro Signal.</p>
        <Button type="submit" variant="primary" loading={busy}>Tatsächliche Ausführung speichern</Button>
      </form>}
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
  </article>;
}
export default function SignalsPage() {
  const { data, error: networkError, mutate } = useSWR<Payload>('/api/signals', url => fetch(url, { cache: 'no-store' }).then(r => r.json()), { refreshInterval: 30000 });
  const [key, setKey] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<Config | null>(null), [showConfig, setShowConfig] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => { const timer = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (data?.config && !showConfig) setConfig(data.config); }, [data, showConfig]);
  async function action(fn: () => Promise<unknown>, success: string) {
    setBusy(true); setMessage('');
    try { await fn(); await mutate(); setMessage(success); } catch (e) { setMessage(e instanceof Error ? e.message : 'Fehler'); } finally { setBusy(false); }
  }
  if (!data && !networkError) return <div className="p-6 text-[#8B8FA8]">Signale werden geladen …</div>;
  if (networkError || (data?.error && data.configured === undefined)) return <div className="p-6 text-red-400">{networkError?.message ?? data?.error}</div>;
  if (data?.error) return <div className="mx-auto max-w-lg p-6 lg:pt-12"><div className={panel}>
    <LockKeyhole size={28} className="mb-4 text-[#B8E15A]" /><h1 className="text-2xl font-bold text-white">Handelssignale</h1>
    <p className="my-4 text-sm text-[#8B8FA8]">Dein geschützter Bereich für Kauf- und Verkaufssignale und ausgeführte Trades.</p>
    {data.configured ? <form onSubmit={e => { e.preventDefault(); void action(() => request('/api/signals/session', 'POST', { key }).then(result => { setKey(''); return result; }), 'Signalbereich entsperrt'); }}>
      <Input label="Persönlicher Zugangsschlüssel" type="password" autoComplete="current-password" value={key} onChange={e => setKey(e.target.value)} required />
      <Button className="mt-4" type="submit" variant="primary" loading={busy}>Entsperren</Button>
    </form> : <p className="text-sm text-amber-300">Der Signalbereich ist noch nicht freigeschaltet. Ein persönlicher Zugangsschlüssel muss auf dem Server eingerichtet werden.</p>}
    {message && <p role="status" className="mt-3 text-sm text-amber-300">{message}</p>}
  </div></div>;
  if (!data?.config || !config) return null;
  const pending = data.signals.filter(s => s.status === 'pending');
  const history = data.signals.filter(s => s.status !== 'pending');
  const locked = !!data.round || pending.length > 0;
  const r = data.round;
  const metrics = r && data.quote?.bid != null ? roundMetrics(r, data.quote.bid) : null;
  const stale = data.config.enabled && (!data.checkedAt || Date.now() - Date.parse(data.checkedAt) > 7 * 60000);
  const open = marketOpen(data.config, new Date()); void tick;
  const entryPolicy = data.dataFeed?.entryPolicy ?? (data.config as Config & { vixEntryPolicy?: 'realtime' | 'delayed20' }).vixEntryPolicy ?? 'realtime';
  const productTime = data.quote?.productAt ? Date.parse(data.quote.productAt) : NaN;
  const productAge = Number.isFinite(productTime) ? Date.now() - productTime : null;
  const productAgeText = productAge == null ? 'Kurszeit unbekannt' : productAge < 0 ? 'Kurszeit liegt in der Zukunft' : `${Math.floor(productAge / 60000)} Min. alt${productAge > 300000 ? ' · älter als 5 Min.' : ''}`;
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig({ ...config, [k]: v });
  const refresh = () => { void mutate(); };
  return <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs uppercase tracking-[.2em] text-[#B8E15A]">Deine Strategie · Deine Ausführung</p><h1 className="text-3xl font-bold text-white">Handelssignale</h1><p className="mt-2 max-w-xl text-sm text-[#8B8FA8]">Die App überwacht die Regeln. Du handelst beim Broker und schickst danach den Screenshot im Chat.</p></div>
      <Button loading={busy} onClick={() => action(() => request('/api/signals/check', 'POST'), 'Prüflauf abgeschlossen')}><RefreshCw size={16} />Jetzt prüfen</Button>
    </header>
    {message && <p role="status" className="rounded-xl border border-[#B8E15A]/20 p-4 text-sm text-[#B8E15A]">{message}</p>}
    <section className={`${panel} flex flex-wrap items-start justify-between gap-4`}><div className="flex gap-3"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${!data.config.enabled ? 'bg-[#8B8FA8]' : stale ? 'bg-red-400' : open ? 'bg-[#B8E15A]' : 'bg-amber-400'}`} /><div><p className="font-medium text-white">{!data.config.enabled ? 'Überwachung pausiert' : !open ? 'Broker-Handelsfenster geschlossen' : stale ? 'Prüflauf überfällig' : 'Überwachung eingerichtet'}</p><p className="mt-1 text-sm text-[#8B8FA8]">{data.health}</p><p className="mt-1 text-xs text-[#8B8FA8]">Letzte Prüfung: {data.checkedAt ? time(data.checkedAt) : 'noch keine'} · {data.config.broker || 'Broker offen'} {data.config.opensAt && `${data.config.opensAt}–${data.config.closesAt} Uhr, Europe/Berlin`}</p></div></div><Button variant="ghost" onClick={() => { setConfig(data.config); setShowConfig(!showConfig); }}>Einrichtung {showConfig ? 'schließen' : 'öffnen'}</Button></section>
    <div className="rounded-xl border border-[#2E2E3A] p-3 text-sm text-[#8B8FA8]">
      <p>{entryPolicy === 'delayed20' ? 'Einstieg: Yahoo, bis 20 Min. Kursalter. Ein kostenpflichtiger Datenzugang ist für diese Regel nicht erforderlich.' : 'Einstieg: Echtzeit-VIX, bis 5 Min. Kursalter. Verzögerte Kurse lösen bei dieser Einstellung keine Käufe aus.'}</p>
      <p className="mt-1">Ausstieg: Vontobel-Geldkurs bis 5 Min. Der zuletzt bekannte Kurs ist kein garantierter Ausführungspreis.</p>
      <p className="mt-1">Yahoo-Kurse sind typischerweise etwa 15 Min. verzögert; die Signalprüfung ist alle 5 Min. vorgesehen.</p>
      {data.quote && <p className="mt-1">Vontobel-Kurszeit: {Number.isFinite(productTime) ? `${time(data.quote.productAt!)} Uhr (Berlin)` : 'unbekannt'} · {productAgeText}</p>}
    </div>
    <section className="grid gap-3 sm:grid-cols-3">
      {[['Strategiekapital', euro(r?.capital ?? data.config.capital), r ? 'Für diese Runde festgeschrieben' : 'Budget für die nächste Runde'], ['Bestätigter Einsatz', euro(r?.spent ?? 0), 'Kumulierte Käufe inklusive Gebühren'], ['Offene Signale', String(pending.length), 'Signal ist keine ausgeführte Order']].map(([label, value, sub]) => <div key={label} className={panel}><p className="text-xs text-[#8B8FA8]">{label}</p><p className="my-2 text-2xl font-semibold text-white">{value}</p><p className="text-xs text-[#8B8FA8]">{sub}</p></div>)}
    </section>
    {r && <section className={panel}><h2 className="font-semibold text-white">Offene Signalrunde · Variante {r.config.variant}</h2><div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"><div><p className="text-xs text-[#8B8FA8]">Bestand</p><p className="mt-1 text-white">{r.lots.reduce((n, l) => n + l.quantity, 0)} Stück</p></div><div><p className="text-xs text-[#8B8FA8]">Rundenergebnis, letzter Kurs</p><p className="mt-1 text-white">{metrics ? euro(metrics.pnl) : 'Kurs fehlt'}</p></div><div><p className="text-xs text-[#8B8FA8]">Trailing</p><p className="mt-1 text-white">{r.trailing ? `Aktiv · Faktor ${r.floorFactor.toFixed(4)}` : 'Ab +10 %'}</p></div><div><p className="text-xs text-[#8B8FA8]">Beginn</p><p className="mt-1 text-white">{time(r.startedAt)}</p></div></div><p className="mt-4 text-xs text-[#8B8FA8]">Bewertung anhand des letzten Geldkurses {data.quote?.productAt ? time(data.quote.productAt) : '(fehlt)'}. Erwartete Verkaufsgebühren sind noch nicht abgezogen; bestätigte Gebühren sind enthalten.</p></section>}
    <section><div className="mb-4 flex items-center gap-2"><BellRing size={18} className="text-[#B8E15A]" /><h2 className="text-lg font-semibold text-white">Jetzt zu beachten</h2></div><div className="space-y-4">{pending.length ? pending.map(s => <SignalCard key={s.id} signal={s} onDone={refresh} />) : <div className={`${panel} py-9 text-center`}><ShieldCheck className="mx-auto mb-3 text-[#8B8FA8]" size={30} /><p className="font-medium text-white">Kein offenes Handelssignal</p><p className="mt-2 text-sm text-[#8B8FA8]">{data.config.enabled ? 'Die nächste gültige Regelverletzung erscheint hier.' : 'Zuerst Produkt, Brokerzeiten und Versand einrichten.'}</p></div>}</div></section>
    {showConfig && <section className={panel}><h2 className="text-xl font-semibold text-white">Strategie & Benachrichtigungen</h2><p className="mt-2 text-sm text-[#8B8FA8]">Long-Kaskade 30 / 40 / 50 %, maximal 50 % Einsatz. Kein weiterer Kauf bei 12,5. Trailing ab +10 % mit 8 / 6 / 5 % Abstand. {locked && 'Produkt und Strategie sind während offener Signale oder einer Runde gesperrt.'}</p>
      <form className="mt-6 space-y-6" onSubmit={e => { e.preventDefault(); void action(() => request('/api/signals', 'PUT', { ...config, closedDates: config.closedDates.filter(Boolean) }), 'Einrichtung gespeichert'); }}>
        <p className="text-xs text-[#8B8FA8]">Das Strategiekapital wird aus bestätigten Ausführungen fortgeschrieben. Ein- und Auszahlungen bitte zuerst abstimmen.</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Strategiekapital in EUR" type="number" min="1" step="any" disabled={locked || !!data.capitalManaged} value={config.capital} onChange={e => set('capital', Number(e.target.value))} />
          <Select label="Ausstiegsvariante" disabled={locked} value={config.variant} onChange={e => set('variant', e.target.value as Config['variant'])} options={[{ value: 'A', label: 'A · Zeitverkauf nach 10 Tagen' }, { value: 'B', label: 'B · 80-%-Reduktion / Restposition' }, { value: 'C', label: 'C · B plus 6-%-Rundenlimit' }]} />
          <Select label="Geplanter Einstiegshebel" disabled={locked} value={config.leverage} onChange={e => set('leverage', Number(e.target.value))} options={[1.5, 1.9, 2, 2.3].map(n => ({ value: String(n), label: String(n) }))} />
          <Input label="Long-Zertifikat · ISIN" disabled={locked} value={config.isin} onChange={e => set('isin', e.target.value.toUpperCase().trim())} placeholder="Geprüftes aktives EUR-Produkt" />
          <Input label="WKN" disabled={locked} value={config.wkn} onChange={e => set('wkn', e.target.value.toUpperCase().trim())} />
          <Input label="Knock-out-Barriere (USD)" type="number" step="any" min="0" disabled={locked} value={config.barrier} onChange={e => set('barrier', Number(e.target.value))} />
          <Input label="VX-Kontraktname" disabled={locked} value={config.futureName} onChange={e => set('futureName', e.target.value)} placeholder="Konkreter Kontraktmonat, kein VIX3M" />
          <Input label="VX-Symbol beim Emittenten" disabled={locked} value={config.futureSymbol} onChange={e => set('futureSymbol', e.target.value)} placeholder="Aus geprüften Produktdaten" />
          <Input label="VX-Verfallstag" type="date" disabled={locked} value={config.futureExpiry} onChange={e => set('futureExpiry', e.target.value)} />
          <Input label="Broker & Handelsplatz" value={config.broker} onChange={e => set('broker', e.target.value)} placeholder="Wird noch festgelegt" />
          <Input label="Handelsbeginn (Berlin)" type="time" value={config.opensAt} onChange={e => set('opensAt', e.target.value)} />
          <Input label="Handelsende (Berlin, exklusiv)" type="time" value={config.closesAt} onChange={e => set('closesAt', e.target.value)} />
        </div>
        <Textarea label="Handelsfreie Tage (YYYY-MM-DD, ein Datum pro Zeile)" value={config.closedDates.join('\n')} onChange={e => set('closedDates', e.target.value.split('\n').map(s => s.trim()))} />
        <p className="text-xs text-[#8B8FA8]">Es gilt das gemeinsame Handelsfenster von Broker, Handelsplatz und Produkt. Wochenenden werden automatisch gesperrt, Feiertage und Sonderzeiten müssen passend zum Handelsplatz gepflegt werden.</p>
        <div className="space-y-3 text-sm text-white">
          <label className="flex items-start gap-3"><input className="mt-1 accent-[#B8E15A]" type="checkbox" disabled={locked} checked={config.productVerified} onChange={e => set('productVerified', e.target.checked)} /><span>Long-Richtung, tatsächlicher VX-Basisvertrag, EUR-Notierung und geplanter Hebel wurden anhand des Produktblatts geprüft.</span></label>
          {(['telegram', 'email'] as const).map(c => <label key={c} className="flex items-center gap-3"><input className="accent-[#B8E15A]" type="checkbox" checked={config[c]} onChange={e => set(c, e.target.checked)} /><span>{c === 'telegram' ? 'Telegram' : 'E-Mail'} · {data.channels[c] ? 'Zugang eingerichtet' : 'noch nicht eingerichtet'}</span></label>)}
          <label className="flex items-center gap-3"><input className="accent-[#B8E15A]" type="checkbox" checked={config.enabled} onChange={e => set('enabled', e.target.checked)} /><span>Signalüberwachung aktivieren</span></label>
        </div>
        <Button type="submit" variant="primary" loading={busy}>Einrichtung speichern</Button>
      </form>
      <div className="mt-6 rounded-xl bg-[#1A1A22] p-4"><div className="flex items-center gap-2 font-medium text-white"><Send size={16} />Telegram plus E-Mail</div><p className="mt-2 text-sm text-[#8B8FA8]">Telegram wird einmalig über deinen eigenen Bot verbunden. Die E-Mail-Adresse wird aus den App-Einstellungen übernommen. Verkaufssignale werden während der Handelszeiten alle 15 Minuten erinnert, bis eine Ausführung oder „Nicht ausgeführt“ erfasst ist.</p></div>
    </section>}
    {history.length > 0 && <section><h2 className="mb-4 text-lg font-semibold text-white">Signalverlauf</h2><div className="space-y-4">{history.slice(0, 30).map(s => <SignalCard key={s.id} signal={s} onDone={refresh} />)}</div></section>}
    {data.executions.length > 0 && <section className={panel}><h2 className="font-semibold text-white">Bestätigte Ausführungen</h2><div className="mt-4 divide-y divide-[#1E1E28]">{data.executions.slice(0, 20).map(e => <div key={e.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><p className="text-white">{e.side === 'buy' ? 'Kauf' : 'Verkauf'} · {e.quantity} × {euro(e.price)}</p><p className="mt-1 text-xs text-[#8B8FA8]">{e.isin} · {time(e.at)}{e.note && ` · ${e.note}`}</p></div><p className="text-[#8B8FA8]">Gebühren {euro(e.fees)}</p></div>)}</div></section>}
  </div>;
}
