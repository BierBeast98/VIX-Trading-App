/** Deterministic long strategy. No network, DB, clock or broker side effects. */
export type Config = {
  enabled: boolean; capital: number; variant: 'A' | 'B' | 'C'; leverage: number;
  vixEntryPolicy?: 'realtime' | 'delayed20';
  isin: string; wkn: string; futureSymbol: string; futureName: string; futureExpiry: string;
  productVerified: boolean; barrier: number; email: boolean; telegram: boolean;
  broker: string; opensAt: string; closesAt: string; closedDates: string[];
};
export type Quote = { isin: string; at: string; vix: number | null; vixAt: string | null; vixRealtime?: boolean; vixSource?: string; vixFeedMode?: 'realtime' | 'delayed' | 'unknown'; vixFeedError?: string;
  future: number | null; futureAt: string | null; bid: number | null; ask: number | null;
  productAt: string | null; askAt?: string | null; productValid?: boolean; error?: string };
export type Lot = { id: string; quantity: number; originalQuantity: number; cost: number;
  entryPrice: number; fees: number; enteredAt: string; tradeId?: string; positionId?: string };
export type Round = { id: string; capital: number; spent: number; realized: number; startedAt: string;
  stage: number; reduced: boolean; day10Checked: boolean; trailing: boolean; peakFactor: number; floorFactor: number;
  lots: Lot[]; config: Config };
export type Signal = { id: string; roundId: string | null; side: 'buy' | 'sell'; reason: string;
  isin: string; at: string; expiresAt: string; status: 'pending' | 'executed' | 'skipped' | 'expired' | 'superseded';
  budget: number; targetPct: number; stage: number; price: number; quantity: number;
  allocations: { lotId: string; quantity: number }[]; capital: number; vix: number | null;
  vixAt?: string | null; vixSource?: string; vixFeedMode?: Quote['vixFeedMode']; vixAgeMinutes?: number | null;
  quoteAt: string; notification: Partial<Record<'email' | 'telegram', { sentAt?: string; error?: string }>>;
};
export type Execution = { id: string; signalId: string; side: 'buy' | 'sell'; isin: string;
  quantity: number; price: number; fees: number; at: string; note: string };
export type State = { version: 1; config: Config; round: Round | null; signals: Signal[];
  executions: Execution[]; armed: boolean; previousVix: number | null; previousVixAt: string | null;
  checkedAt: string | null; health: string; quote: Quote | null };
export const defaults: Config = { enabled: false, capital: 10000, variant: 'C', leverage: 2.3, vixEntryPolicy: 'realtime',
  isin: '', wkn: '', futureSymbol: '', futureName: '', futureExpiry: '', productVerified: false,
  barrier: 0, email: true, telegram: true, broker: '', opensAt: '', closesAt: '', closedDates: [] };
export const initialState = (): State => ({ version: 1, config: { ...defaults }, round: null,
  signals: [], executions: [], armed: false, previousVix: null, previousVixAt: null,
  checkedAt: null, health: 'Noch nicht geprüft', quote: null });
const MINUTE = 60000;
export function fresh(at: string | null, now: Date): boolean {
  const age = at ? now.getTime() - Date.parse(at) : NaN;
  return Number.isFinite(age) && age >= -MINUTE && age <= 5 * MINUTE;
}
/** Only entry spot tolerance changes with policy; certificate/VX freshness stays at five minutes. */
export function entryVixUsable(cfg: Pick<Config, 'vixEntryPolicy'>, quote: Quote, now: Date): boolean {
  if (!positive(quote.vix)) return false;
  if (cfg.vixEntryPolicy === 'delayed20') {
    const age = quote.vixAt ? now.getTime() - Date.parse(quote.vixAt) : NaN;
    return quote.vixSource === 'yahoo' && quote.vixFeedMode === 'delayed' &&
      Number.isFinite(age) && age >= -MINUTE && age <= 20 * MINUTE;
  }
  return (cfg.vixEntryPolicy == null || cfg.vixEntryPolicy === 'realtime') &&
    quote.vixRealtime === true && fresh(quote.vixAt, now);
}
function positive(n: number | null): n is number { return n !== null && Number.isFinite(n) && n > 0; }
export function roundMetrics(r: Round, bid: number) {
  const cost = r.lots.reduce((n, l) => n + l.cost, 0);
  const quantity = r.lots.reduce((n, l) => n + l.quantity, 0);
  const value = quantity * bid;
  return { cost, quantity, value, factor: cost > 0 ? value / cost : 0,
    pnl: r.realized + value - cost };
}
export function marketOpen(cfg: Config, now: Date): boolean {
  if (!cfg.broker || !/^\d{2}:\d{2}$/.test(cfg.opensAt) || !/^\d{2}:\d{2}$/.test(cfg.closesAt)) return false;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const time = `${part('hour')}:${part('minute')}`;
  return !['Sat', 'Sun'].includes(part('weekday')) && !cfg.closedDates.includes(date) && time >= cfg.opensAt && time < cfg.closesAt;
}
export function evaluate(state: State, quote: Quote, now: Date): State {
  const s = structuredClone(state);
  s.checkedAt = now.toISOString();
  if (quote.productAt && state.quote?.productAt && Date.parse(quote.productAt) < Date.parse(state.quote.productAt)) {
    s.health = 'Älteres Kursergebnis eines überlappenden Prüflaufs verworfen'; return s;
  }
  s.quote = quote;
  for (const signal of s.signals) {
    if (signal.side === 'buy' && signal.status === 'pending' && Date.parse(signal.expiresAt) < now.getTime()) signal.status = 'expired';
  }
  if (!s.config.enabled) { s.health = 'Überwachung pausiert'; return s; }
  const cfg = s.round?.config ?? s.config;
  if (!marketOpen(s.config, now)) { s.health = 'Handelsfenster geschlossen oder Brokerzeiten noch nicht eingerichtet'; return s; }
  if (quote.isin !== cfg.isin) { s.health = 'Produktwechsel während Kursabruf; erneute Prüfung erforderlich'; return s; }
  const goodSpot = entryVixUsable(cfg, quote, now);
  const goodBid = positive(quote.bid) && fresh(quote.productAt, now);
  const previous = s.previousVix;
  const previousAt = s.previousVixAt;
  const newSpot = goodSpot && (!previousAt || Date.parse(quote.vixAt!) > Date.parse(previousAt));
  // Compare consecutive original source samples, including accepted delayed entry samples. Never infer a crossing after a source gap.
  const consecutive = newSpot && previousAt !== null && Date.parse(quote.vixAt!) - Date.parse(previousAt) <= 10 * MINUTE;
  if (newSpot) { s.previousVix = quote.vix; s.previousVixAt = quote.vixAt; if (quote.vix! >= 15.5) s.armed = true; }
  const pending = s.signals.find(x => x.status === 'pending');
  const add = (side: 'buy' | 'sell', reason: string, stage: number, budget: number, targetPct: number, allocations: Signal['allocations'] = []) => {
    const price = side === 'buy' ? quote.ask! : quote.bid!;
    const quantity = side === 'buy' ? Math.floor(budget / price) : allocations.reduce((n, a) => n + a.quantity, 0);
    if (quantity <= 0) { s.health = 'Betrag reicht nicht für ein ganzes Stück'; return; }
    s.signals.unshift({ id: crypto.randomUUID(), roundId: s.round?.id ?? null, side, reason,
      isin: cfg.isin, at: now.toISOString(), expiresAt: new Date(now.getTime() + 5 * MINUTE).toISOString(),
      status: 'pending', budget, targetPct, stage, price, quantity, allocations,
      capital: s.round?.capital ?? cfg.capital, vix: goodSpot ? quote.vix : null,
      vixAt: quote.vixAt, vixSource: quote.vixSource, vixFeedMode: quote.vixFeedMode,
      vixAgeMinutes: quote.vixAt && Number.isFinite(Date.parse(quote.vixAt)) ? (now.getTime() - Date.parse(quote.vixAt)) / MINUTE : null,
      quoteAt: quote.productAt!, notification: {} });
  };
  if (s.round) {
    const r = s.round;
    if (!goodBid) { s.health = 'Verkaufsprüfung blockiert: kein frischer Geldkurs'; return s; }
    const m = roundMetrics(r, quote.bid!);
    if (m.factor >= 1.1) r.trailing = true;
    if (r.trailing) {
      r.peakFactor = Math.max(r.peakFactor, m.factor);
      const gap = r.peakFactor >= 1.35 ? .05 : r.peakFactor >= 1.2 ? .06 : .08;
      r.floorFactor = Math.max(r.floorFactor, r.peakFactor * (1 - gap));
    }
    // Calendar days in Berlin, including DST changes.
    const day = (d: Date) => Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d));
    const days = (day(now) - day(new Date(r.startedAt))) / 86400000;
    const checkReduction = cfg.variant !== 'A' && days >= 10 && !r.day10Checked;
    if (checkReduction) r.day10Checked = true;
    let reason = ''; let partial = false;
    if (cfg.variant === 'C' && m.pnl <= -.06 * r.capital) reason = 'Rundenverlustlimit −6 % erreicht';
    else if (m.factor <= .6) reason = 'Positionsverlustgrenze −40 % erreicht';
    else if (r.trailing && m.factor < r.floorFactor) reason = 'Trailing-Barriere unterschritten';
    else if (cfg.variant === 'A' && days >= 10) reason = 'Zeitverkauf nach zehn Kalendertagen';
    else if (cfg.variant !== 'A' && days >= 20 && !r.trailing) reason = 'Restposition nach 20 Kalendertagen schließen';
    else if (checkReduction && !r.reduced && !r.trailing && m.factor <= 1) { reason = '80-%-Reduktion ab Tag zehn'; partial = true; }
    if (reason) {
      if (pending?.side === 'sell' && (!partial && pending.reason.includes('80-%'))) pending.status = 'superseded';
      else if (pending?.side === 'sell') { s.health = 'Verkaufssignal wartet auf Ausführungsbestätigung'; return s; }
      if (pending?.side === 'buy') pending.status = 'superseded';
      add('sell', reason, r.stage, 0, 0, r.lots.filter(l => l.quantity > 0).map(l => ({ lotId: l.id, quantity: partial ? Math.max(1, Math.floor(l.quantity * .8)) : l.quantity })));
      s.health = 'Verkaufssignal erstellt'; return s;
    }
    if (pending) { s.health = 'Offenes Signal wartet auf Bestätigung'; return s; }
    if (r.trailing || r.reduced) { s.health = r.trailing ? 'Trailing aktiv; keine Nachkäufe' : 'Restposition überwacht; keine Nachkäufe'; return s; }
  } else if (pending) { s.health = 'Kaufsignal wartet auf Bestätigung'; return s; }
  if (!cfg.productVerified || !cfg.isin || !cfg.futureSymbol || !cfg.futureName || !cfg.futureExpiry || cfg.barrier <= 0) { s.health = 'Long-Zertifikat und VX-Basisvertrag müssen geprüft und hinterlegt werden'; return s; }
  if (quote.productValid === false) { s.health = quote.error ?? 'Produktprüfung fehlgeschlagen'; return s; }
  if (!goodSpot) {
    s.health = cfg.vixEntryPolicy === 'delayed20'
      ? 'Kauf blockiert: Yahoo-VIX mit bestätigter Verzögerung und Originalzeitstempel bis 20 Minuten erforderlich'
      : 'Kauf blockiert: VIX-Echtzeitfeed fehlt, ist veraltet oder nicht freigegeben';
    return s;
  }
  if (!goodBid || !positive(quote.ask) || !fresh(quote.askAt ?? quote.productAt, now) || quote.ask < quote.bid!) { s.health = quote.error ?? 'Kauf blockiert: frische VIX-, Geld- und Briefkurse erforderlich'; return s; }
  if (!positive(quote.future) || !fresh(quote.futureAt, now)) { s.health = 'Kauf blockiert: kein frischer Kurs des tatsächlichen VX-Basisvertrags'; return s; }
  if ((Date.parse(cfg.futureExpiry + 'T00:00:00Z') - now.getTime()) / 86400000 < 30) { s.health = 'Kauf blockiert: VX-Restlaufzeit unter 30 Tagen'; return s; }
  if (quote.future / quote.vix! - 1 > .15 + 1e-10) { s.health = 'Kauf blockiert: VX-Aufschlag über 15 %'; return s; }
  if (quote.future <= cfg.barrier) { s.health = 'Kauf blockiert: Basiswert an/unter Knock-out-Barriere'; return s; }
  if (!consecutive || previous === null) { s.health = 'Warte auf beobachtete Abwärtskreuzung mit freigegebenen VIX-Quelldaten'; return s; }
  let stage = 0;
  if (!s.round) {
    if (s.armed && previous >= 15.5 && quote.vix! < 15.5) stage = quote.vix! <= 13.5 ? 3 : quote.vix! <= 14.5 ? 2 : 1;
  } else {
    if (previous > 14.5 && quote.vix! <= 14.5 && s.round.stage < 2) stage = 2;
    if (previous > 13.5 && quote.vix! <= 13.5 && s.round.stage < 3) stage = 3;
  }
  if (stage) {
    const pct = [0, 30, 40, 50][stage];
    const capital = s.round?.capital ?? cfg.capital;
    const budget = Math.max(0, capital * pct / 100 - (s.round?.spent ?? 0));
    add('buy', s.round ? 'Nachkauf: neue Abwärtskreuzung' : 'Einstieg: VIX unterschreitet 15,5', stage, budget, pct);
    s.health = 'Kaufsignal erstellt';
  } else s.health = 'Überwachung aktiv; kein neues Signal';
  return s;
}
export type Fill = { signalId: string; action: 'execute' | 'skip'; quantity?: number; price?: number; fees?: number; at?: string; note?: string };
export function confirm(state: State, fill: Fill, now: Date): State {
  const s = structuredClone(state);
  const signal = s.signals.find(x => x.id === fill.signalId);
  if (!signal) throw new Error('Signal nicht gefunden');
  const recorded = s.executions.find(x => x.signalId === signal.id);
  if (recorded) {
    if (fill.action !== 'execute' || recorded.quantity !== fill.quantity || recorded.price !== fill.price || recorded.fees !== (fill.fees ?? 0)) throw new Error('Für dieses Signal ist bereits eine andere Ausführung erfasst');
    return s; // exact retry = no duplicate
  }
  // Expired/superseded signals may still have been executed at the broker. Record the actual fill.
  if (!['pending', 'expired', 'superseded', 'skipped'].includes(signal.status)) throw new Error('Signal bereits abgeschlossen');
  if (fill.action === 'skip') { signal.status = 'skipped'; return s; }
  const { quantity, price, fees = 0 } = fill;
  const at = fill.at ?? now.toISOString();
  if (!Number.isInteger(quantity) || quantity! <= 0 || !positive(price ?? null) || !Number.isFinite(fees) || fees < 0 || !Number.isFinite(Date.parse(at)) || Date.parse(at) > now.getTime() + MINUTE || Date.parse(at) < Date.parse(signal.at)) throw new Error('Stückzahl, Kurs, Gebühren oder Ausführungszeit ungültig');
  if (signal.side === 'buy') {
    if (s.round && signal.roundId !== s.round.id) throw new Error('Signal gehört zu einer anderen Runde');
    if (!s.round && signal.roundId) throw new Error('Handelsrunde bereits geschlossen');
    // Actual broker fills must remain recordable even when they differ from the recommendation.
    if (signal.isin !== (s.round?.config.isin ?? s.config.isin)) throw new Error('Produkt wurde seit dem Signal geändert; vor Erfassung abgleichen');
    if (!s.round) s.round = { id: crypto.randomUUID(), capital: signal.capital, spent: 0, realized: 0,
      startedAt: at, stage: 0, reduced: false, day10Checked: false, trailing: false, peakFactor: 1, floorFactor: 0,
      lots: [], config: { ...s.config } };
    const cost = quantity! * price! + fees;
    s.round.lots.push({ id: crypto.randomUUID(), quantity: quantity!, originalQuantity: quantity!, cost, entryPrice: price!, fees, enteredAt: at });
    s.round.spent += cost; s.round.stage = Math.max(s.round.stage, signal.stage); s.armed = false;
    // A late buy changes exposure; any sell recommendation must be recalculated before further action.
    for (const other of s.signals) if (other.id !== signal.id && other.status === 'pending') other.status = 'superseded';
  } else {
    const r = s.round;
    if (!r || signal.roundId !== r.id) throw new Error('Keine passende offene Runde');
    const available = signal.allocations.reduce((n, a) => n + Math.min(a.quantity, r.lots.find(l => l.id === a.lotId)?.quantity ?? 0), 0);
    if (quantity! > available) throw new Error('Verkauf überschreitet den zugehörigen Bestand');
    // Proportional allocation across tranches, remainder distributed deterministically.
    let left = quantity!;
    const allocations = signal.allocations.map(a => ({ ...a, sell: Math.floor(quantity! * a.quantity / signal.quantity) }));
    left -= allocations.reduce((n, a) => n + a.sell, 0);
    for (const a of allocations) if (left > 0 && a.sell < a.quantity) { a.sell++; left--; }
    for (const a of allocations) {
      if (a.sell === 0) continue;
      const lot = r.lots.find(l => l.id === a.lotId)!;
      if (a.sell > lot.quantity) throw new Error('Bestand wurde zwischenzeitlich verändert');
      const allocatedCost = lot.cost * a.sell / lot.quantity;
      r.realized += a.sell * price! - fees * a.sell / quantity! - allocatedCost;
      lot.quantity -= a.sell; lot.cost -= allocatedCost;
    }
    r.reduced = true;
    for (const other of s.signals) if (other.id !== signal.id && other.status === 'pending') other.status = 'superseded';
    if (r.lots.every(l => l.quantity === 0)) {
      s.config.capital = Math.max(0, r.capital + r.realized);
      s.round = null; s.armed = false;
    }
  }
  signal.status = 'executed';
  s.executions.unshift({ id: crypto.randomUUID(), signalId: signal.id, side: signal.side, isin: signal.isin,
    quantity: quantity!, price: price!, fees, at, note: fill.note ?? '' });
  s.health = 'Ausführung erfasst; nächste Prüfung aktualisiert die Signale';
  return s;
}
