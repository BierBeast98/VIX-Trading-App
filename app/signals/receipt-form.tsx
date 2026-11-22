'use client';
import { useState } from 'react';
import type { State } from '@/lib/signals/engine';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Receipt = NonNullable<State['receipts']>[number];
export function ReceiptForm({ receipt, state, onDone }: { receipt: Receipt; state: State; onDone: () => void }) {
  const signals = state.signals.filter(s => s.side === 'buy' && s.status !== 'executed' && !s.settlement);
  const hints = state.levels?.events.filter(e => e.entryHint && !state.round && !state.executions.some(x => x.signalId === e.id)) ?? [];
  const options = [...signals.map(s => ({ id: s.id, label: s.reason, at: s.at })), ...hints.map(e => ({
    id: e.id, label: `Einstieg bei VIX ${e.value.toLocaleString('de-DE')}`, at: e.at,
  }))].filter(x => (!receipt.signalId || x.id === receipt.signalId) && (!receipt.levelId || x.id === receipt.levelId || !hints.some(e => e.id === receipt.levelId)));
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  if (!options.length) return null;
  return <details className="w-full"><summary className="cursor-pointer text-accent">Kaufdaten prüfen und buchen</summary>
    <form className="my-3 grid gap-3 sm:grid-cols-2" onSubmit={async e => {
      e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError('');
      try {
        const res = await fetch('/api/signals/confirm', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
          action:'execute', signalId:f.get('signal'), receipt:{id:receipt.id, isin:f.get('isin')},
          quantity:Number(f.get('quantity')), price:Number(f.get('price')), fees:Number(f.get('fees')),
          at:new Date(String(f.get('at'))).toISOString(), note:`Telegram-Beleg ${receipt.id}`,
        })});
        if (!res.ok) throw new Error((await res.json()).error);
        onDone();
      } catch (e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen'); }
      finally { setBusy(false); }
    }}>
      <label className="sm:col-span-2">Zugehöriger Hinweis
        <select className="block w-full rounded bg-surface-2 p-2" required name="signal" defaultValue={receipt.signalId ?? (options.some(o => o.id === receipt.levelId) ? receipt.levelId : '')}>
          <option value="">Hinweis auswählen</option>{options.map(o => <option key={o.id} value={o.id}>{o.label} · {new Date(o.at).toLocaleString('de-DE')}</option>)}
        </select></label>
      <Input required label="Gekaufte ISIN" name="isin" pattern="[A-Z]{2}[A-Z0-9]{9}[0-9]" defaultValue={receipt.fields?.isin} />
      <Input required label="Stückzahl" name="quantity" type="number" min="1" step="1" defaultValue={receipt.fields?.quantity} />
      <Input required label="Ausführungskurs in EUR" name="price" type="number" min="0.000001" step="any" defaultValue={receipt.fields?.price} />
      <Input required label="Gebühren in EUR" name="fees" type="number" min="0" step="any" defaultValue={receipt.fields?.fees} />
      <Input required label="Ausführungszeit (Gerätezeit)" name="at" type="datetime-local" />
      <Button type="submit" loading={busy}>Geprüften Kauf buchen</Button>
      {error && <p role="alert" className="text-red-400">{error}</p>}
    </form></details>;
}
