'use client';
import { useEffect, useRef, useState } from 'react';
import { ReceiptForm } from './receipt-form';
import useSWR from 'swr';
import { BellRing, Check, ChevronDown, RefreshCw, ShieldCheck } from 'lucide-react';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  entryLevels, notificationLevels, ENTRY_TARGETS, DEFAULT_VIX_LEVELS, futureDaysLeft, roundMetrics, marketOpen,
  type State, type Config, type Signal, type Round, type VixLevels,
} from '@/lib/signals/engine';
import { telegramTestLabels, type TelegramTest } from '@/lib/signals/telegram-tests';
type Payload = State & { dataFeed?: { provider: string; keyConfigured: boolean; entryPolicy?: 'realtime' | 'delayed20'; maxVixAgeMinutes?: number; productMaxAgeMinutes?: number }; capitalManaged?: boolean; channels: { email: boolean; telegram: boolean; links: boolean }; error?: string; configured?: boolean };
const euro = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const percentage = (n: number) => n.toLocaleString('de-DE', { style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' });
const time = (s: string) => new Date(s).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
const panel = 'rounded-2xl border border-[#1E1E28] bg-[#141418] p-5';
async function request(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Anfrage fehlgeschlagen');
  return data;
}
type Receipt = NonNullable<State['receipts']>[number];
function SignalCard({ signal, receipt, now, onDone }: { signal: Signal; receipt?: Receipt; now: Date; onDone: () => void }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [quantity, setQuantity] = useState(String(signal.quantity)), [price, setPrice] = useState(''), [fees, setFees] = useState('');
  const [at, setAt] = useState(''), [note, setNote] = useState(''), [tax, setTax] = useState('');
  const buy = signal.side === 'buy';
  const expired = buy && Date.parse(signal.expiresAt) < now.getTime();
  const canRecord = signal.status !== 'executed';
  const status = ({ pending: expired ? 'Abgelaufen' : 'Bestätigung offen', executed: 'Ausgeführt', skipped: 'Nicht ausgeführt', expired: 'Abgelaufen', superseded: 'Durch neueres Signal ersetzt' })[signal.status];
  async function submit(action: 'execute' | 'skip') {
    setBusy(true); setError('');
    try {
      if (action === 'execute' && (!at || !price || fees === '')) throw new Error('Tatsächlichen Kurs, Gebühren (auch 0) und Ausführungszeit eintragen');
      await request('/api/signals/confirm', 'POST', { signalId: signal.id, action,
        ...(action === 'execute' ? { quantity: Number(quantity), price: Number(price), fees: Number(fees), at: new Date(at).toISOString(), note, ...(!buy && tax !== '' ? { taxWithheld: Number(tax) } : {}) } : {}) });
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
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#8B8FA8]">{(['telegram', 'email'] as const).map(c => <span key={c}>{c === 'email' ? 'E-Mail' : 'Telegram'}: {signal.notification[c]?.error ?? (signal.notification[c]?.sentAt ? `vom Anbieter angenommen ${time(signal.notification[c]!.sentAt!)}` : 'noch nicht zugestellt')}</span>)}</div>
    {canRecord && <div className="mt-5 border-t border-[#1E1E28] pt-4">
      <p className="mb-3 text-sm text-[#8B8FA8]">Trade ausgeführt? Schicke den Screenshot im Chat. Alternativ hier selbst erfassen.</p>
      {expired && <p className="mb-3 text-sm text-amber-300">Dieses Kaufsignal ist nicht mehr aktuell. Nur eine bereits erfolgte Ausführung nachtragen.</p>}
      {receipt && <div className="mb-3 text-sm text-muted">
        <a className="text-accent underline" href={`/api/telegram/receipts?id=${encodeURIComponent(receipt.id)}`} target="_blank" rel="noreferrer">Telegram-Beleg prüfen</a>
        {receipt.fields?.isin === signal.isin && <Button variant="ghost" onClick={() => {
          setQuantity(String(receipt.fields?.quantity ?? '')); setPrice(String(receipt.fields?.price ?? ''));
          setFees(String(receipt.fields?.fees ?? '')); setNote(`Telegram-Beleg ${receipt.id}`); setOpen(true);
        }}>Belegdaten übernehmen</Button>}
      </div>}
      <Button onClick={() => setOpen(!open)}><Check size={16} />Ausführung erfassen<ChevronDown size={14} /></Button>
      {signal.status === 'pending' && <Button className="ml-2" variant="ghost" loading={busy} onClick={() => submit('skip')}>Nicht ausgeführt</Button>}
      {open && <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void submit('execute'); }}>
        <Input label="Tatsächliche Stückzahl" type="number" min="1" step="1" required value={quantity} onChange={e => setQuantity(e.target.value)} />
        <Input label="Ausführungskurs in EUR" type="number" min="0.000001" step="any" required value={price} onChange={e => setPrice(e.target.value)} />
        <Input label="Gebühren gesamt in EUR" type="number" min="0" step="any" required value={fees} onChange={e => setFees(e.target.value)} />
        {!buy && <Input label="Steuerabzug laut Abrechnung in EUR" hint="Leer = unbekannt · 0 = kein Abzug" type="number" min="0" step="0.01" value={tax} onChange={e => setTax(e.target.value)} />}
        <Input label="Ausgeführt am (Gerätezeit)" type="datetime-local" required value={at} onChange={e => setAt(e.target.value)} />
        <div className="sm:col-span-2"><Textarea label="Notiz / Beleg" value={note} onChange={e => setNote(e.target.value)} placeholder="z. B. Brokerabrechnung / Screenshot, Ordernummer" /></div>
        <p className="text-xs text-[#8B8FA8] sm:col-span-2">Bei mehreren Teilausführungen: gesamte ausgeführte Stückzahl, gewichteter Durchschnittskurs und gesamte Gebühren eintragen. Eine Bestätigung pro Signal.</p>
        <Button type="submit" variant="primary" loading={busy}>Tatsächliche Ausführung speichern</Button>
      </form>}
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
  </article>;
}
const levelLabel = (level: number) => level.toLocaleString('de-DE', { maximumFractionDigits: 6 });
const reduction = 'Ohne aktives Trailing 80 % ab Tag 10 bei ≤ 0 % reduzieren und den Rest ab Tag 20 verkaufen';
const variants = {
  A: 'Zeitverkauf nach 10 Tagen',
  B: reduction,
  C: 'Ohne aktives Trailing alle 15 Kalendertage prüfen. Bei ≤ −10 % einmalig 50 % verkaufen, bei einer späteren Prüfung den Rest bei ≤ −20 % verkaufen',
};

function LevelInputs({ config, field, disabled, onChange }: {
  config: Config;
  field: 'entryLevels' | 'notificationLevels';
  disabled?: boolean;
  onChange: (levels: VixLevels) => void;
}) {
  const forEntries = field === 'entryLevels';
  const levels = forEntries ? entryLevels(config) : notificationLevels(config);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-white">{forEntries ? 'Kaufstufen' : 'VIX-Niveau-Meldungen'}</legend>
      <p className="text-xs text-muted">{forEntries
        ? 'Abwärtskreuzungen für konkrete Kaufsignale bei erfüllter Produktprüfung.'
        : 'Unabhängige Hinweise beim Erreichen oder Unterschreiten, auch ohne Prüfprodukt.'}</p>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {levels.map((level, index) => <Input key={index} label={forEntries ? `${ENTRY_TARGETS[index]} % Einsatz` : `Niveau ${index + 1}`}
          type="number" inputMode="decimal" min="0.000001" step="any" required disabled={disabled} value={level || ''}
          onChange={event => {
            const next: VixLevels = [...levels];
            next[index] = Number(event.target.value);
            onChange(next);
          }} />)}
      </div>
    </fieldset>
  );
}

function StrategySettings({ saved, locked, capitalManaged, channels, onSaved }: {
  saved: Config; locked: boolean; capitalManaged?: boolean; channels: Payload['channels']; onSaved: (state: State) => void;
}) {
  const [draft, setDraft] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const config = draft ?? saved;
  const set = <K extends keyof Config>(key: K, value: Config[K]) => setDraft({ ...config, [key]: value });
  async function save() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      for (const levels of [entryLevels(config), notificationLevels(config)]) {
        if (!(levels[0] > levels[1] && levels[1] > levels[2] && levels[2] > 0)) {
          throw new Error('Gib die drei Schwellen jeweils absteigend ein.');
        }
      }
      const result: State = await request('/api/signals', 'PUT', { ...config, closedDates: config.closedDates.filter(Boolean) });
      onSaved(result);
      setDraft(null);
      setMessage('Strategie gespeichert.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details id="strategie-bearbeiten" className="mt-4 scroll-mt-20 border-t border-border pt-4">
      <summary className="cursor-pointer text-sm font-semibold text-accent">Strategie und Überwachung bearbeiten</summary>
      <form className="mt-5 space-y-6" onSubmit={event => { event.preventDefault(); void save(); }}>
        {locked && <p className="text-sm text-amber-300">Kaufstufen, Ausstiegsregeln und Produkt sind während einer offenen Runde oder eines offenen Signals gesperrt. VIX-Niveau-Meldungen kannst du weiterhin ändern.</p>}
        <LevelInputs config={config} field="entryLevels" disabled={locked} onChange={levels => set('entryLevels', levels)} />
        <LevelInputs config={config} field="notificationLevels" onChange={levels => set('notificationLevels', levels)} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Strategiekapital in EUR" type="number" min="1" step="any" disabled={locked || !!capitalManaged} value={config.capital} onChange={e => set('capital', Number(e.target.value))} />
          <Select label="Ausstiegsvariante" disabled={locked} value={config.variant} onChange={e => {
            const variant = e.target.value as Config['variant'];
            setDraft(variant === 'C' && config.leverage !== 2
              ? { ...config, variant, leverage: 2, productVerified: false }
              : { ...config, variant });
          }} options={[{ value: 'A', label: 'A · Zeitverkauf' }, { value: 'B', label: 'B · Reduktion und Restverkauf' }, { value: 'C', label: 'C · Prüfung alle 15 Tage' }]} />
          <Select label="Geplanter Einstiegshebel" disabled={locked || config.variant === 'C'} value={config.leverage} onChange={e => set('leverage', Number(e.target.value))} options={[1.5, 1.9, 2, 2.3].map(n => ({ value: String(n), label: levelLabel(n) }))} />
        </div>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium text-white">Prüfprodukt für Handelssignale</legend>
          <p className="text-xs text-muted">Die App prüft die Kaufbedingungen für dieses Produkt. Bestand entsteht durch eine bestätigte Ausführung.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Prüfprodukt · ISIN" disabled={locked} value={config.isin} onChange={e => {
              const isin = e.target.value.toUpperCase().trim();
              setDraft({ ...config, isin, productVerified: false });
            }} />
            <Input label="WKN" disabled={locked} value={config.wkn} onChange={e => set('wkn', e.target.value.toUpperCase().trim())} />
            <Input label="Knock-out-Barriere (USD)" type="number" step="any" min="0" disabled={locked} value={config.barrier} onChange={e => setDraft({ ...config, barrier: Number(e.target.value), productVerified: false })} />
            <Input label="VX-Kontraktname" disabled={locked} value={config.futureName} onChange={e => setDraft({ ...config, futureName: e.target.value, productVerified: false })} />
            <Input label="VX-Symbol beim Emittenten" disabled={locked} value={config.futureSymbol} onChange={e => setDraft({ ...config, futureSymbol: e.target.value, productVerified: false })} />
            <Input label="VX-Verfallstag" type="date" disabled={locked} value={config.futureExpiry} onChange={e => setDraft({ ...config, futureExpiry: e.target.value, productVerified: false })} />
          </div>
          <label className="flex items-start gap-3 text-sm text-white"><input className="mt-1 accent-accent" type="checkbox" disabled={locked} checked={config.productVerified} onChange={e => set('productVerified', e.target.checked)} /><span>Long-Richtung, VX-Basisvertrag, EUR-Notierung und geplanter Hebel sind anhand des Produktblatts geprüft.</span></label>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Broker und Handelsplatz" value={config.broker} onChange={e => set('broker', e.target.value)} />
          <Input label="Handelsbeginn (Berlin)" type="time" value={config.opensAt} onChange={e => set('opensAt', e.target.value)} />
          <Input label="Handelsende (Berlin)" type="time" value={config.closesAt} onChange={e => set('closesAt', e.target.value)} />
        </div>
        <Textarea label="Handelsfreie Tage (YYYY-MM-DD, ein Datum pro Zeile)" value={config.closedDates.join('\n')} onChange={e => set('closedDates', e.target.value.split('\n').map(s => s.trim()))} />
        <div className="space-y-3 text-sm text-white">
          {(['telegram', 'email'] as const).map(channel => <label key={channel} className="flex items-center gap-3"><input className="accent-accent" type="checkbox" checked={config[channel]} onChange={e => set(channel, e.target.checked)} /><span>{channel === 'telegram' ? 'Telegram' : 'E-Mail'} · {channels[channel] ? 'Zugang eingerichtet' : 'noch nicht eingerichtet'}</span></label>)}
          <label className="flex items-center gap-3"><input className="accent-accent" type="checkbox" checked={config.enabled} onChange={e => set('enabled', e.target.checked)} /><span>Überwachung aktivieren</span></label>
        </div>
        <Button type="submit" variant="primary" loading={busy}>Strategie speichern</Button>
        {message && <p role="status" className="text-sm text-accent">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </form>
    </details>
  );
}

function TelegramTests({ connected }: { connected: boolean }) {
  const [busy, setBusy] = useState<TelegramTest | null>(null);
  const [status, setStatus] = useState<{ message: string; error: boolean } | null>(null);
  async function send(scenario: TelegramTest) {
    setBusy(scenario);
    setStatus(null);
    try {
      await request('/api/telegram/test', 'POST', { scenario });
      setStatus({ message: `Telegram hat den Test „${telegramTestLabels[scenario]}“ angenommen.`, error: false });
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : 'Testversand fehlgeschlagen.', error: true });
    } finally {
      setBusy(null);
    }
  }
  return <section id="telegram-tests" className={`${panel} scroll-mt-20`}>
    <h2 className="text-lg font-semibold text-white">Telegram-Signale testen</h2>
    <p className="mt-2 text-sm text-muted">{connected
      ? 'Jeder Knopf sendet ein fiktives Beispiel an deinen verknüpften Telegram-Chat.'
      : 'Verbinde Telegram, um Testnachrichten zu senden.'}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      {(Object.keys(telegramTestLabels) as TelegramTest[]).map(scenario => <Button key={scenario}
        type="button" disabled={!connected || busy !== null} loading={busy === scenario}
        onClick={() => void send(scenario)}>{telegramTestLabels[scenario]} testen</Button>)}
    </div>
    {status && <p role={status.error ? 'alert' : 'status'} className={`mt-3 text-sm ${status.error ? 'text-red-400' : 'text-accent'}`}>{status.message}</p>}
  </section>;
}

type AppSettings = { alertEmail: string; vontobelIsin: string };
function NotificationSettings({ onSaved }: { onSaved: () => void }) {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.location.hash === '#einstellungen') section.current?.scrollIntoView();
  }, []);
  const { data, error, mutate } = useSWR<AppSettings>('/api/settings');
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState<'save' | 'email' | 'telegram' | null>(null);
  const [status, setStatus] = useState({ message: '', isError: false });
  const values = draft ?? data;
  async function action(kind: NonNullable<typeof busy>, config: AppSettings) {
    setBusy(kind);
    setStatus({ message: '', isError: false });
    try {
      if (kind === 'save') {
        const saved = await request('/api/settings', 'PUT', config);
        await mutate(saved, { revalidate: false });
        setDraft(null);
        onSaved();
        setStatus({ message: 'Einstellungen gespeichert.', isError: false });
      } else if (kind === 'email') {
        const result = await request('/api/alerts/test', 'POST', { email: config.alertEmail });
        if (!result.success) throw new Error('Die Test-E-Mail konnte nicht gesendet werden.');
        setStatus({ message: 'Test-E-Mail vom Anbieter angenommen.', isError: false });
      } else {
        await request('/api/telegram/test', 'POST');
        setStatus({ message: 'Testnachricht von Telegram angenommen.', isError: false });
      }
    } catch (err) {
      setStatus({ message: err instanceof Error ? err.message : 'Anfrage fehlgeschlagen.', isError: true });
    } finally {
      setBusy(null);
    }
  }
  return (
    <section ref={section} id="einstellungen" className={`${panel} scroll-mt-20`}>
      <h2 className="text-lg font-semibold text-white">Benachrichtigungen und Datenquellen</h2>
      {error && <p role="alert" className="mt-3 text-sm text-red-400">Einstellungen konnten nicht geladen werden.</p>}
      {!error && !values && <p role="status" className="mt-3 text-sm text-muted">Einstellungen werden geladen …</p>}
      {values && <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); void action('save', values); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="E-Mail für Benachrichtigungen" type="email" value={values.alertEmail} onChange={e => setDraft({ alertEmail: e.target.value, vontobelIsin: values.vontobelIsin })} />
          <Input label="Zertifikat im Dashboard · ISIN" hint="Legt fest, welcher Chart im Dashboard erscheint." pattern="[A-Z0-9]{12}" value={values.vontobelIsin} onChange={e => setDraft({ alertEmail: values.alertEmail, vontobelIsin: e.target.value.toUpperCase().trim() })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy === 'save'} disabled={busy !== null}>Einstellungen speichern</Button>
          <Button type="button" variant="ghost" loading={busy === 'email'} disabled={busy !== null || !values.alertEmail}
            onClick={event => { if (event.currentTarget.form?.reportValidity()) void action('email', values); }}>Test-E-Mail senden</Button>
          <Button type="button" variant="ghost" loading={busy === 'telegram'} disabled={busy !== null} onClick={() => void action('telegram', values)}>Telegram-Testnachricht senden</Button>
        </div>
        {status.message && <p role={status.isError ? 'alert' : 'status'} className={status.isError ? 'text-sm text-red-400' : 'text-sm text-accent'}>{status.message}</p>}
      </form>}
    </section>
  );
}

function SettlementForm({ round, onDone }: { round: Round; onDone: () => void }) {
  const [proceeds, setProceeds] = useState('');
  const [fees, setFees] = useState('');
  const [tax, setTax] = useState('');
  const [at, setAt] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const quantity = round.lots.reduce((sum, lot) => sum + lot.quantity, 0);
  async function settle() {
    setBusy(true);
    setError('');
    try {
      await request('/api/signals/confirm', 'POST', {
        action: 'settle', roundId: round.id, quantity, proceeds: Number(proceeds), fees: Number(fees), at: new Date(at).toISOString(), note,
        ...(tax !== '' ? { taxWithheld: Number(tax) } : {}),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ausbuchung konnte nicht erfasst werden.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mt-5 border-t border-border pt-4">
      <summary className="cursor-pointer text-sm font-medium text-accent">Ausbuchung oder Knock-out erfassen</summary>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); if (confirmed) void settle(); }}>
        <p className="text-sm text-muted sm:col-span-2">Erfasse den bestätigten Gesamtbetrag für alle {quantity} Stück ({round.config.isin}) laut Brokerabrechnung. Gebühren und Steuern separat eintragen.</p>
        <Input label="Restwert gesamt in EUR vor Abzügen" type="number" min="0" step="0.01" required value={proceeds} onChange={e => setProceeds(e.target.value)} hint="Bei wertloser Ausbuchung 0 eintragen." />
        <Input label="Gebühren in EUR" type="number" min="0" step="0.01" required value={fees} onChange={e => setFees(e.target.value)} />
        <Input label="Steuerabzug in EUR" type="number" min="0" step="0.01" value={tax} onChange={e => setTax(e.target.value)} hint="Leer = unbekannt · 0 = kein Abzug" />
        <Input label="Abgerechnet am (Gerätezeit)" type="datetime-local" required value={at} onChange={e => setAt(e.target.value)} />
        <div className="sm:col-span-2"><Input label="Notiz oder Belegnummer" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></div>
        <label className="flex items-start gap-2 text-sm text-white sm:col-span-2"><input className="mt-1 accent-accent" type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Die Brokerabrechnung bestätigt die Ausbuchung des gesamten Restbestands.</label>
        <Button className="justify-self-start" variant="primary" type="submit" loading={busy} disabled={!confirmed}>Ausbuchung speichern</Button>
        {error && <p role="alert" className="text-sm text-red-400 sm:col-span-2">{error}</p>}
      </form>
    </details>
  );
}

export default function SignalsPage() {
  const [inboxBusy, setInboxBusy] = useState(false);
  const [inboxStatus, setInboxStatus] = useState('');
  const { data, error: networkError, mutate } = useSWR<Payload>('/api/signals', url => request(url, 'GET'), { refreshInterval: 30000 });
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [clock, setClock] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setClock(Date.now());
    const initial = setTimeout(update, 0);
    const timer = setInterval(update, 30000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, []);
  const refresh = () => { void mutate(); };
  async function check() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const result = await request('/api/signals/check', 'POST');
      await mutate();
      setMessage(result.message ?? 'Prüflauf abgeschlossen.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prüfung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }
  if (!data && networkError) return <p role="alert" className="p-6 text-red-400">{networkError.message}</p>;
  if (!data || clock == null) return <p role="status" className="p-6 text-muted">Signale werden geladen …</p>;

  const now = new Date(clock);
  const { config, round } = data;
  const strategy = round?.config ?? config;
  const pending = data.signals.filter(s => s.status === 'pending');
  const history = data.signals.filter(s => s.status !== 'pending' && !s.settlement);
  const locked = !!round || pending.length > 0;
  const open = marketOpen(config, now);
  const stale = config.enabled && (!data.checkedAt || clock - Date.parse(data.checkedAt) > 7 * 60000);
  const monitorStatus = !config.enabled ? 'Überwachung pausiert' : !open ? 'Handelsfenster geschlossen' : stale ? 'Prüflauf überfällig' : 'Überwachung aktiv';
  const statusColor = !config.enabled ? 'bg-muted' : !open ? 'bg-amber-400' : stale ? 'bg-red-400' : 'bg-accent';
  const quote = data.quote?.isin === strategy.isin ? data.quote : null;
  const daysLeft = futureDaysLeft(strategy, now);
  const productStatus = quote?.issuerStatus === 'inactive' ? 'Beim Emittenten inaktiv'
    : !strategy.productVerified ? 'Produktprüfung offen'
    : quote?.issuerStatus === 'mismatch' ? 'Produktdaten oder VX-Zuordnung weichen ab'
    : quote?.issuerStatus === 'unavailable' ? 'Emittentenstatus vorübergehend nicht verfügbar'
    : daysLeft != null && daysLeft <= 0 ? 'Hinterlegter VX-Verfall erreicht'
    : daysLeft != null && daysLeft < 30 ? 'VX-Restlaufzeit unter 30 Tagen'
    : quote?.productValid === true ? 'Emittent meldet Produkt aktiv'
    : 'Emittentenstatus noch ungeklärt';
  const metrics = round && quote?.bid != null && quote.issuerStatus !== 'inactive' ? roundMetrics(round, quote.bid) : null;
  const entryPolicy = data.dataFeed?.entryPolicy ?? strategy.vixEntryPolicy ?? 'realtime';
  const legacyC = strategy.variant === 'C' && round != null && round.reviewPeriod == null;
  const reviewRules = strategy.variant === 'C' && !legacyC;
  const variantText = legacyC ? `${reduction}. Rundenverlustlimit −6 %` : variants[strategy.variant];

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-white">Handelssignale</h1>
        <Button loading={busy} onClick={() => void check()}><RefreshCw size={16} />Jetzt prüfen</Button>
      </header>
      {(message || error || networkError) && <p role={error || networkError ? 'alert' : 'status'} className="rounded-xl border border-border p-3 text-sm text-muted">{error || (networkError ? 'Aktualisierung fehlgeschlagen. Die Seite zeigt den zuletzt geladenen Stand.' : message)}</p>}

      <section className={`${panel} flex flex-wrap items-start justify-between gap-3`} aria-label="Prüfstatus">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${statusColor}`} />
          <div>
            <p className="font-medium text-white">{monitorStatus}</p>
            <p className="mt-1 text-sm text-muted">{data.health}</p>
            <p className="mt-1 text-xs text-muted">Letzte Prüfung {data.checkedAt ? time(data.checkedAt) : 'ausstehend'}{config.broker && ` · ${config.broker}`}{config.opensAt && ` · ${config.opensAt}–${config.closesAt} Uhr Berlin`}</p>
          </div>
        </div>
        <a href="#einstellungen" className="text-sm font-medium text-accent hover:underline">Einstellungen</a>
      </section>

      <section className={panel}>
        <h2 className="text-lg font-semibold text-white">Aktuelle Strategie</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
          <li><span className="text-white">Long-Kaufstufen</span> · {(legacyC ? strategy.entryLevels ?? DEFAULT_VIX_LEVELS : entryLevels(strategy)).map((level, index) => `unter ${levelLabel(level)} → ${ENTRY_TARGETS[index]} %`).join(' · ')} kumulierter Einsatz</li>
          <li><span className="text-white">VIX-Niveau-Meldungen</span> · bei oder unter {notificationLevels(config).map(levelLabel).join(' / ')}</li>
          <li><span className="text-white">Einstieg</span> · Hebelziel {levelLabel(strategy.leverage)}, VX-Aufschlag max. 15 %, VX-Restlaufzeit mind. 30 Tage</li>
          <li><span className="text-white">Ausstieg</span> · Variante {strategy.variant}. {variantText}. {reviewRules
            ? 'Positionsverlustgrenze −35 %. Trailing ab +30 %, Verkaufsschwelle 5 Prozentpunkte unter dem erreichten Renditehoch.'
            : 'Positionsverlustgrenze −40 %. Trailing ab +10 % mit 8 / 6 / 5 % Abstand.'}</li>
          <li><span className="text-white">Strategiekapital</span> · {euro(round?.capital ?? config.capital)}{round ? ` · ${euro(round.spent)} bestätigt eingesetzt` : ''}</li>
        </ul>
        <StrategySettings saved={config} locked={locked} capitalManaged={data.capitalManaged} channels={data.channels} onSaved={state => { void mutate(current => current && { ...current, ...state }); }} />
      </section>

      <section className={panel}>
        <h2 className="text-lg font-semibold text-white">Prüfprodukt für Handelssignale</h2>
        {strategy.isin ? <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a target="_blank" rel="noreferrer" className="font-mono text-sm text-accent hover:underline" href={`https://markets.vontobel.com/de-de/produkte/hebel/mini-futures/${encodeURIComponent(strategy.isin)}`}>{strategy.isin}</a>
            <span className="rounded-md bg-surface-2 px-2 py-1 text-xs text-muted">{productStatus}</span>
          </div>
          <p className="mt-2 text-sm text-muted">{strategy.futureName || 'VX-Basisvertrag ausstehend'}{strategy.futureExpiry && ` · VX-Verfall ${new Date(strategy.futureExpiry).toLocaleDateString('de-DE', { timeZone: 'UTC' })}`}</p>
          <p className="mt-2 text-xs text-muted">{round ? 'Der Bestand unten stammt aus bestätigten Ausführungen.' : 'Kein Bestand in der Signalrunde. Die ISIN dient der Kaufprüfung.'}</p>
        </> : <p className="mt-3 text-sm text-muted">Für konkrete Kaufsignale ein Prüfprodukt hinterlegen. VIX-Niveau-Meldungen laufen unabhängig davon.</p>}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white"><BellRing size={18} className="text-accent" />Offene Handelssignale</h2>
        <div className="space-y-3">{pending.length ? pending.map(signal => <SignalCard key={signal.id} signal={signal} receipt={data.receipts?.find(r => r.signalId === signal.id)} now={now} onDone={refresh} />)
          : <div className={`${panel} text-center`}><ShieldCheck className="mx-auto mb-2 text-muted" size={24} /><p className="text-sm text-muted">Kein offenes Handelssignal</p></div>}</div>
      </section>

      <section className={panel}>
        <h2 className="text-lg font-semibold text-white">Kaufbelege aus Telegram</h2>
        <p className="my-3 text-sm text-muted">Schicke den Kaufbeleg als Foto oder Bilddatei (JPG, PNG, WebP, bis 8 MB) an den verbundenen Bot. Wenn du auf ein Handelssignal antwortest, erscheint der Beleg mit einem Link zum Signal.</p>
        <Button loading={inboxBusy} onClick={async () => {
          setInboxBusy(true);
          try { await request('/api/telegram/receipts', 'POST'); await mutate(); setInboxStatus('Belege aktualisiert'); }
          catch { setInboxStatus('Abruf fehlgeschlagen. Bitte erneut versuchen.'); }
          finally { setInboxBusy(false); }
        }}>Belege abrufen</Button>
        {inboxStatus && <p role="status" className="mt-2 text-sm text-muted">{inboxStatus}</p>}
        {!data.receipts?.length && <p className="mt-3 text-sm text-muted">Noch keine Kaufbelege eingegangen.</p>}
        {data.receipts?.map(r => <div key={r.id} className="mt-3 flex flex-wrap gap-4 text-sm">
          <a className="text-accent underline" href={`/api/telegram/receipts?id=${encodeURIComponent(r.id)}`} target="_blank" rel="noreferrer">Beleg vom {time(r.at)} öffnen</a>
          {r.fields && <span className="text-muted">{[r.fields.isin, r.fields.quantity && `${r.fields.quantity} Stück`, r.fields.price && `Kurs ${euro(r.fields.price)}`, r.fields.fees != null && `Gebühren ${euro(r.fields.fees)}`].filter(Boolean).join(' · ')}</span>}
          {r.signalId && <a className="text-accent underline" href={`#${r.signalId}`}>Zur Ausführung</a>}
          <ReceiptForm receipt={r} state={data} onDone={refresh} />
        </div>)}
      </section>

      {round && <section className={panel}>
        <h2 className="text-lg font-semibold text-white">Offene Signalrunde</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
          <div><dt className="text-xs text-muted">Bestand</dt><dd className="mt-1">{round.lots.reduce((sum, lot) => sum + lot.quantity, 0)} Stück</dd></div>
          <div><dt className="text-xs text-muted">Rendite der offenen Position</dt><dd className="mt-1">{metrics && metrics.cost > 0 ? percentage(metrics.factor - 1) : 'Bewertung ausstehend'}</dd></div>
          <div><dt className="text-xs text-muted">Rundenergebnis vor Steuern</dt><dd className="mt-1">{metrics ? euro(metrics.pnl) : 'Bewertung ausstehend'}</dd></div>
          <div><dt className="text-xs text-muted">Trailing</dt><dd className="mt-1">{round.trailing ? `Schwelle ${percentage(round.floorFactor - 1)}` : reviewRules ? 'Ab +30 %' : 'Ab +10 %'}</dd></div>
          <div><dt className="text-xs text-muted">Beginn</dt><dd className="mt-1">{time(round.startedAt)}</dd></div>
        </dl>
        {metrics && <p className="mt-3 text-xs text-muted">Letzter Geldkurs {quote?.productAt ? time(quote.productAt) : 'ohne Zeitangabe'} · bisher bestätigte Gebühren enthalten.</p>}
        <SettlementForm key={round.id} round={round} onDone={refresh} />
      </section>}

      <section className={panel}>
        <h2 className="text-lg font-semibold text-white">VIX-Niveau-Meldungen</h2>
        <p className="mt-2 text-sm text-muted">Hinweise zum VIX. Die Kaufbedingungen für ein Zertifikat werden separat geprüft.</p>
        {!(data.levels?.events?.length) && <p className="mt-3 text-sm text-muted">Noch keine Niveau-Meldung aufgezeichnet.</p>}
        {(data.levels?.events ?? []).slice(0, 10).map(event => (
          <article key={event.id} className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted">
            <p className="text-white">{event.entryHint ? 'Einstiegshinweis' : `Niveau ${event.levels.map(levelLabel).join(' / ')} erreicht`} · VIX {levelLabel(event.value)}</p>
            <p>Kurszeit {time(event.sourceAt)} · {event.source === 'yahoo' ? 'Yahoo Finance' : event.source}{event.delayed ? ' · verzögert' : ''}</p>
            <p className="text-xs">{(['telegram', 'email'] as const).map(channel => `${channel === 'telegram' ? 'Telegram' : 'E-Mail'}: ${event.notification[channel]?.sentAt ? 'vom Anbieter angenommen' : !config[channel] ? 'deaktiviert' : event.notification[channel]?.error ?? (clock - Date.parse(event.at) > 1800000 ? 'Versandfenster abgelaufen' : 'Versand ausstehend')}`).join(' · ')}</p>
          </article>
        ))}
      </section>

      <NotificationSettings onSaved={refresh} />
      <TelegramTests connected={data.channels.telegram} />
      {history.length > 0 && <details className={panel}>
        <summary className="cursor-pointer text-lg font-semibold text-white">Signalverlauf</summary>
        <div className="mt-4 space-y-3">{history.slice(0, 30).map(signal => <SignalCard key={signal.id} signal={signal} receipt={data.receipts?.find(r => r.signalId === signal.id)} now={now} onDone={refresh} />)}</div>
      </details>}
      {data.executions.length > 0 && <section className={panel}>
        <h2 className="text-lg font-semibold text-white">Bestätigte Abrechnungen</h2>
        <div className="mt-3 divide-y divide-border">{data.executions.slice(0, 20).map(execution => <div key={execution.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
          <div><p className="text-white">{execution.settlement ? `Ausbuchung · ${execution.quantity} Stück · ${euro(execution.price * execution.quantity)} Restwert` : `${execution.side === 'buy' ? 'Kauf' : 'Verkauf'} · ${execution.quantity} × ${euro(execution.price)}`}</p><p className="mt-1 text-xs text-muted">{execution.isin} · {time(execution.at)}{execution.note && ` · ${execution.note}`}</p></div>
          <p className="text-muted">Gebühren {euro(execution.fees)}{execution.side === 'sell' && ` · Steuerabzug ${execution.taxWithheld == null ? 'unbekannt' : euro(execution.taxWithheld)}`}</p>
        </div>)}</div>
      </section>}

      <details className={`${panel} text-sm text-muted`}>
        <summary className="cursor-pointer font-medium text-white">Datenregeln und Ausführung</summary>
        <div className="mt-3 space-y-2">
          <p>{entryPolicy === 'delayed20' ? 'Einstieg mit Yahoo-VIX bis 20 Minuten Kursalter.' : 'Einstieg mit Echtzeit-VIX bis 5 Minuten Kursalter.'} Verkaufssignale verwenden einen Vontobel-Geldkurs bis 5 Minuten Kursalter.</p>
          <p>Die Positionsrendite vergleicht den Geldwert aller offenen Stücke mit ihren bestätigten Kaufkosten inklusive Kaufgebühren. Nach einem Teilverkauf zählen die offenen Reststücke und ihre anteiligen Kosten.</p>
          <p>Die App benachrichtigt dich. Du handelst beim Broker und erfasst danach die tatsächliche Ausführung. Eigenständige Käufe im Trade-Verlauf erscheinen ohne bestätigte Signalausführung außerhalb der Signalrunde.</p>
        </div>
      </details>
    </div>
  );
}
