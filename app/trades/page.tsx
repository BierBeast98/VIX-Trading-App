"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { getRefreshInterval } from "@/lib/trading-hours";
import { Plus, Pencil, Trash2, Download, Bell, BellOff, TrendingUp, Loader2, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { formatDate, formatNumber, formatPct } from "@/lib/utils";

interface Trade {
  id: string;
  certificateId: string;
  direction: "long" | "short";
  entryDate: string;
  exitDate: string | null;
  entryVix: number;       // VIX Future Preis bei Einstieg
  exitVix: number | null; // VIX Future Preis bei Ausstieg
  barrierLevel: number;   // Stop-Loss Barriere (USD)
  strikePrice: number | null;   // Basispreis (USD)
  leverageRatio: number | null; // Hebel
  ratio: number | null;         // Bezugsverhältnis (z.B. 0.10)
  entryPrice: number | null;    // Einstiegskurs (EUR)
  exitPrice: number | null;     // Ausstiegskurs (EUR)
  quantity: number | null;      // Stückzahl
  returnPct: number | null;
  holdDays: number | null;
  alertTriggered: boolean;
  notes: string;
}

const EMPTY_FORM = {
  certificateId: "",
  direction: "short" as "long" | "short",
  entryDate: new Date().toISOString().split("T")[0],
  exitDate: "",
  entryVix: "",
  exitVix: "",
  barrierLevel: "",
  strikePrice: "",
  leverageRatio: "",
  ratio: "0.1",
  entryPrice: "",
  exitPrice: "",
  quantity: "",
  returnPct: "",
  alertTriggered: false,
  notes: "",
};

export default function TradesPage() {
  const { data: trades = [], isLoading: loading, mutate: mutateTrades } = useSWR<Trade[]>("/api/trades");

  // Live prices for open trades
  const openIsins = useMemo(
    () => [...new Set(trades.filter((t) => !t.exitDate).map((t) => t.certificateId))],
    [trades]
  );
  const { data: batchData } = useSWR<{ prices: Record<string, { bid: number | null }> }>(
    openIsins.length ? `/api/vontobel/batch?isins=${openIsins.join(",")}` : null,
    { refreshInterval: 300_000 }
  );
  const livePrices: Record<string, { bid: number | null }> = batchData?.prices ?? {};
  const [modalOpen, setModalOpen] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [fetchingProduct, setFetchingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-fill Kontrakt-Parameter from Vontobel when ISIN is 12 chars
  const fetchProductData = useCallback(async (isin: string) => {
    if (!/^[A-Z0-9]{12}$/.test(isin.toUpperCase())) return;
    setFetchingProduct(true);
    setProductError(null);
    try {
      const res = await fetch(`/api/vontobel/product?isin=${isin.toUpperCase()}`);
      if (!res.ok) throw new Error("Produkt nicht gefunden");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setForm((f) => ({
        ...f,
        strikePrice: data.strikePrice != null ? String(data.strikePrice) : f.strikePrice,
        barrierLevel: data.barrierLevel != null ? String(data.barrierLevel) : f.barrierLevel,
        leverageRatio: data.leverage != null ? String(data.leverage) : f.leverageRatio,
        ratio: data.ratio != null ? String(data.ratio) : f.ratio,
        entryVix: data.underlying != null ? String(data.underlying) : f.entryVix,
      }));
    } catch (err: any) {
      setProductError(err.message || "Fehler beim Abrufen");
    } finally {
      setFetchingProduct(false);
    }
  }, []);

  const handleIsinChange = (value: string) => {
    const upper = value.toUpperCase();
    setForm((f) => ({ ...f, certificateId: upper }));
    setProductError(null);
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    if (/^[A-Z0-9]{12}$/.test(upper)) {
      fetchTimerRef.current = setTimeout(() => fetchProductData(upper), 300);
    }
  };

  // Auto-calculate returnPct when entry/exit prices change
  useEffect(() => {
    const ep = parseFloat(form.entryPrice);
    const xp = parseFloat(form.exitPrice);
    if (!isNaN(ep) && ep > 0 && !isNaN(xp) && xp > 0) {
      setForm((f) => ({ ...f, returnPct: (((xp - ep) / ep) * 100).toFixed(2) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.entryPrice, form.exitPrice]);

  const openNew = () => {
    setEditTrade(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (trade: Trade) => {
    setEditTrade(trade);
    setForm({
      certificateId: trade.certificateId,
      direction: trade.direction || "short",
      entryDate: trade.entryDate.split("T")[0],
      exitDate: trade.exitDate ? trade.exitDate.split("T")[0] : "",
      entryVix: String(trade.entryVix),
      exitVix: trade.exitVix !== null ? String(trade.exitVix) : "",
      barrierLevel: String(trade.barrierLevel),
      strikePrice: trade.strikePrice !== null ? String(trade.strikePrice) : "",
      leverageRatio: trade.leverageRatio !== null ? String(trade.leverageRatio) : "",
      ratio: trade.ratio !== null ? String(trade.ratio) : "0.1",
      entryPrice: trade.entryPrice !== null ? String(trade.entryPrice) : "",
      exitPrice: trade.exitPrice !== null ? String(trade.exitPrice) : "",
      quantity: trade.quantity !== null ? String(trade.quantity) : "",
      returnPct: trade.returnPct !== null ? String(trade.returnPct) : "",
      alertTriggered: trade.alertTriggered,
      notes: trade.notes,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!/^[A-Z0-9]{12}$/.test(form.certificateId)) {
      setSaveError("ISIN muss genau 12 Zeichen haben (z.B. DE000VU4MAY5)");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const ep = form.entryPrice ? parseFloat(form.entryPrice) : null;
    const xp = form.exitPrice ? parseFloat(form.exitPrice) : null;
    const autoReturn = ep && xp ? ((xp - ep) / ep) * 100 : null;

    const payload = {
      certificateId: form.certificateId,
      direction: form.direction,
      entryDate: form.entryDate,
      exitDate: form.exitDate || null,
      entryVix: form.entryVix ? parseFloat(form.entryVix) : null,
      exitVix: form.exitVix ? parseFloat(form.exitVix) : null,
      barrierLevel: parseFloat(form.barrierLevel),
      strikePrice: form.strikePrice ? parseFloat(form.strikePrice) : null,
      leverageRatio: form.leverageRatio ? parseFloat(form.leverageRatio) : null,
      ratio: form.ratio ? parseFloat(form.ratio) : null,
      entryPrice: ep,
      exitPrice: xp,
      quantity: form.quantity ? parseInt(form.quantity) : null,
      returnPct: autoReturn ?? (form.returnPct ? parseFloat(form.returnPct) : null),
      alertTriggered: form.alertTriggered,
      notes: form.notes,
    };

    const url = editTrade ? `/api/trades/${editTrade.id}` : "/api/trades";
    const method = editTrade ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await mutateTrades();
        setModalOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err?.error ? JSON.stringify(err.error) : `Fehler ${res.status}`);
      }
    } catch {
      setSaveError("Netzwerkfehler — Datenbankverbindung prüfen");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Trade wirklich löschen?")) return;
    setDeleting(id);
    const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
    if (res.ok) await mutateTrades();
    setDeleting(null);
  };

  const exportCSV = () => {
    const headers = ["ISIN", "Richtung", "Einstieg", "Ausstieg", "Stück", "Kurs Ein (€)", "Kurs Aus (€)", "Invest. (€)", "VIX Future Ein", "VIX Future Aus", "Barrier (USD)", "Basispreis (USD)", "Hebel", "Bezugsverh.", "Rendite %", "Haltetage", "Alert", "Notizen"];
    const rows = trades.map((t) => [
      t.certificateId,
      t.direction === "long" ? "Long" : "Short",
      formatDate(t.entryDate),
      t.exitDate ? formatDate(t.exitDate) : "",
      t.quantity ?? "",
      t.entryPrice ?? "",
      t.exitPrice ?? "",
      t.entryPrice && t.quantity ? (t.entryPrice * t.quantity).toFixed(2) : "",
      t.entryVix,
      t.exitVix ?? "",
      t.barrierLevel,
      t.strikePrice ?? "",
      t.leverageRatio ?? "",
      t.ratio ?? "",
      t.returnPct ?? "",
      t.holdDays ?? "",
      t.alertTriggered ? "Ja" : "Nein",
      t.notes,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Summary statistics — memoized so they only recompute when trades array changes
  const { closedTrades, openTrades, avgReturn, winRate, totalInvested, avgHoldDays, annualizedReturn, totalPnL } =
    useMemo(() => {
      const closed = trades.filter((t) => t.exitDate);
      const open = trades.filter((t) => !t.exitDate);
      const avg = closed.length
        ? closed.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / closed.length
        : 0;
      const wins = closed.length
        ? closed.filter((t) => (t.returnPct ?? 0) > 0).length / closed.length
        : 0;
      const invested = open.reduce(
        (sum, t) => sum + (t.entryPrice && t.quantity ? t.entryPrice * t.quantity : 0),
        0
      );
      const holdDays = closed.length
        ? closed.reduce((sum, t) => sum + Math.max(t.holdDays ?? 1, 1), 0) / closed.length
        : 0;
      const annualized =
        closed.length && holdDays > 0
          ? (Math.pow(1 + avg / 100, 365 / holdDays) - 1) * 100
          : 0;
      const pnl = closed.reduce((sum, t) => {
        if (t.entryPrice && t.exitPrice && t.quantity) {
          return sum + (t.exitPrice - t.entryPrice) * t.quantity;
        }
        return sum;
      }, 0);
      return {
        closedTrades: closed,
        openTrades: open,
        avgReturn: avg,
        winRate: wins,
        totalInvested: invested,
        avgHoldDays: holdDays,
        annualizedReturn: annualized,
        totalPnL: pnl,
      };
    }, [trades]);

  // Live prices for open positions (batch Vontobel fetch)
  const openIsins = openTrades.map((t) => t.certificateId);
  const { data: batchData } = useSWR<{ prices: Record<string, { bid: number | null; underlying: number | null }> }>(
    openIsins.length > 0 ? ["vontobel-batch-trades", ...openIsins] : null,
    async () => {
      try {
        const res = await fetch(`/api/vontobel/batch?isins=${openIsins.join(",")}`);
        if (res.ok) return res.json();
      } catch { /* noop */ }
      return { prices: {} };
    },
    { refreshInterval: getRefreshInterval() }
  );
  const livePrices = batchData?.prices ?? {};

  // Live preview calculations in form
  const formInvestment =
    form.entryPrice && form.quantity
      ? (parseFloat(form.entryPrice) * parseInt(form.quantity)).toFixed(2)
      : null;

  const formAbstandBarrier =
    form.entryVix && form.barrierLevel
      ? (((parseFloat(form.entryVix) - parseFloat(form.barrierLevel)) / parseFloat(form.entryVix)) * 100).toFixed(1)
      : null;

  const formPnL =
    form.entryPrice && form.exitPrice && form.quantity
      ? ((parseFloat(form.exitPrice) - parseFloat(form.entryPrice)) * parseInt(form.quantity)).toFixed(2)
      : null;

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Trades</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8B8FA8" }}>
            {trades.length} Trades gesamt
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={exportCSV}>
            <Download size={14} />
            CSV Export
          </Button>
          <Button variant="primary" size="sm" onClick={openNew}>
            <Plus size={14} />
            Neuer Trade
          </Button>
        </div>
      </div>

      {/* ===== MOBILE: Open Position Hero Card ===== */}
      {!loading && openTrades.length > 0 && (
        <div className="lg:hidden space-y-2.5">
          {openTrades.map((trade) => {
            const investment = trade.entryPrice && trade.quantity ? trade.entryPrice * trade.quantity : null;
            const abstand = trade.entryVix && trade.barrierLevel
              ? ((trade.entryVix - trade.barrierLevel) / trade.entryVix * 100) : null;
            const livePrice = livePrices[trade.certificateId];
            const bid = livePrice?.bid ?? null;
            const pnlPct = bid != null && trade.entryPrice != null && trade.entryPrice > 0
              ? (bid - trade.entryPrice) / trade.entryPrice * 100 : null;
            const pnlEur = bid != null && trade.entryPrice != null && trade.quantity
              ? (bid - trade.entryPrice) * trade.quantity : null;
            return (
              <div
                key={`hero-${trade.id}`}
                className="rounded-2xl p-4 relative overflow-hidden"
                style={{
                  background: trade.direction === "long"
                    ? "linear-gradient(135deg, #141418 0%, #141a24 100%)"
                    : "linear-gradient(135deg, #141418 0%, #1e1418 100%)",
                  border: "1px solid #1E1E28",
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8B8FA8" }}>Offene Position</span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{
                          background: trade.direction === "long" ? "rgba(59,130,246,0.15)" : "rgba(255,77,77,0.15)",
                          color: trade.direction === "long" ? "#3B82F6" : "#FF4D4D",
                        }}
                      >
                        {trade.direction === "long" ? "LONG" : "SHORT"}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-white font-mono">{trade.certificateId}</div>
                  </div>
                  <div className="text-right">
                    {pnlPct != null ? (
                      <>
                        <div
                          className="text-2xl font-bold"
                          style={{ color: pnlPct >= 0 ? "#22C55E" : "#FF4D4D" }}
                        >
                          {pnlPct >= 0 ? "+" : ""}{formatNumber(pnlPct, 1)}%
                        </div>
                        {pnlEur != null && (
                          <span className="text-xs" style={{ color: pnlEur >= 0 ? "#22C55E" : "#FF4D4D" }}>
                            {pnlEur >= 0 ? "+" : ""}{formatNumber(pnlEur, 2)} €
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: "#8B8FA8" }}>Unrealisiert</span>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-white">
                          {investment ? `${investment.toFixed(0)} €` : "—"}
                        </div>
                        <span className="text-[10px]" style={{ color: "#8B8FA8" }}>Investiert</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Einstieg</span>
                    <span className="text-sm font-medium text-white">
                      {trade.entryPrice != null ? `${formatNumber(trade.entryPrice, 2)} €` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Aktuell</span>
                    <span className="text-sm font-medium" style={{ color: bid != null ? "#fff" : "#8B8FA8" }}>
                      {bid != null ? `${formatNumber(bid, 2)} €` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Hebel</span>
                    <span className="text-sm font-medium" style={{ color: "#B8E15A" }}>
                      {trade.leverageRatio != null ? `×${formatNumber(trade.leverageRatio, 2)}` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Barrier</span>
                    <span className="text-sm font-medium text-white">{formatNumber(trade.barrierLevel, 1)}</span>
                    {abstand != null && (
                      <span
                        className="text-[10px] ml-0.5"
                        style={{ color: abstand < 15 ? "#FF4D4D" : abstand < 30 ? "#F59E0B" : "#22C55E" }}
                      >
                        {abstand.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: "1px solid #1E1E28" }}>
                  <span className="text-[10px]" style={{ color: "#8B8FA8" }}>
                    {formatDate(trade.entryDate)} · {trade.quantity} Stück · VIX {formatNumber(trade.entryVix)}
                  </span>
                  <button
                    onClick={() => openEdit(trade)}
                    className="text-[10px] font-medium px-2 py-1 rounded-lg"
                    style={{ background: "#1E1E28", color: "#B8E15A" }}
                  >
                    Bearbeiten
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card>
          <div className="text-xs mb-1" style={{ color: "#8B8FA8" }}>Offene Trades</div>
          <div className="text-2xl font-bold text-white">{openTrades.length}</div>
        </Card>
        <Card>
          <div className="text-xs mb-1" style={{ color: "#8B8FA8" }}>Geschlossene</div>
          <div className="text-2xl font-bold text-white">{closedTrades.length}</div>
        </Card>
        <Card>
          <div className="text-xs mb-1" style={{ color: "#8B8FA8" }}>Win Rate</div>
          <div className="text-2xl font-bold" style={{ color: winRate >= 0.5 ? "#22C55E" : "#FF4D4D" }}>
            {(winRate * 100).toFixed(0)}%
          </div>
        </Card>
        <Card>
          <div className="text-xs mb-1" style={{ color: "#8B8FA8" }}>Ø Rendite</div>
          <div className="text-2xl font-bold" style={{ color: avgReturn >= 0 ? "#22C55E" : "#FF4D4D" }}>
            {formatPct(avgReturn)}
          </div>
        </Card>
        <Card>
          <div className="text-xs mb-1" style={{ color: "#8B8FA8" }}>Annualisiert</div>
          <div className="text-2xl font-bold" style={{ color: annualizedReturn >= 0 ? "#22C55E" : "#FF4D4D" }}>
            {closedTrades.length > 0 && avgHoldDays >= 3
              ? `${annualizedReturn >= 0 ? "+" : ""}${Math.abs(annualizedReturn) > 999 ? ">999" : annualizedReturn.toFixed(1)}%`
              : "—"}
          </div>
        </Card>
        <Card>
          <div className="text-xs mb-1" style={{ color: "#8B8FA8" }}>Gesamt P&L</div>
          <div className="text-2xl font-bold" style={{ color: totalPnL >= 0 ? "#22C55E" : "#FF4D4D" }}>
            {closedTrades.length > 0 ? `${totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(0)} €` : "—"}
          </div>
        </Card>
        <Card>
          <div className="text-xs mb-1" style={{ color: "#8B8FA8" }}>Ø Haltetage</div>
          <div className="text-2xl font-bold text-white">
            {avgHoldDays > 0 ? avgHoldDays.toFixed(0) : "—"}
          </div>
        </Card>
        <Card>
          <div className="text-xs mb-1" style={{ color: "#8B8FA8" }}>Investiert (offen)</div>
          <div className="text-2xl font-bold text-white">
            {totalInvested > 0 ? `${totalInvested.toFixed(0)} €` : "—"}
          </div>
        </Card>
      </div>

      {/* ===== MOBILE: Trade Cards ===== */}
      <div className="lg:hidden space-y-2.5">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#B8E15A] border-t-transparent" />
          </div>
        ) : trades.length === 0 ? (
          <div className="py-12 text-center rounded-2xl" style={{ background: "#141418", border: "1px solid #1E1E28" }}>
            <p style={{ color: "#8B8FA8" }} className="mb-3 text-sm">Noch keine Trades erfasst</p>
            <Button variant="primary" size="sm" onClick={openNew}>
              <Plus size={14} />
              Ersten Trade anlegen
            </Button>
          </div>
        ) : (
          trades.map((trade) => {
            const investment = trade.entryPrice && trade.quantity ? trade.entryPrice * trade.quantity : null;
            const abstand = trade.entryVix && trade.barrierLevel
              ? ((trade.entryVix - trade.barrierLevel) / trade.entryVix * 100) : null;
            const isOpen = !trade.exitDate;
            const isExpanded = expandedTrade === trade.id;
            const liveBid = isOpen ? (livePrices[trade.certificateId]?.bid ?? null) : null;
            const currentPnlPct = liveBid && trade.entryPrice
              ? ((liveBid - trade.entryPrice) / trade.entryPrice) * 100 : null;
            const currentPnlEur = liveBid && trade.entryPrice && trade.quantity
              ? (liveBid - trade.entryPrice) * trade.quantity : null;
            return (
              <div
                key={`mob-${trade.id}`}
                className="rounded-2xl overflow-hidden"
                style={{ background: "#141418", border: "1px solid #1E1E28" }}
              >
                {/* Compact row — always visible */}
                <button
                  className="w-full flex items-center justify-between p-3.5 text-left"
                  onClick={() => setExpandedTrade(isExpanded ? null : trade.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                      style={{
                        background: trade.direction === "long" ? "rgba(59, 130, 246, 0.15)" : "rgba(255, 77, 77, 0.15)",
                        color: trade.direction === "long" ? "#3B82F6" : "#FF4D4D",
                      }}
                    >
                      {trade.direction === "long" ? "LONG" : "SHORT"}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-white truncate block">{trade.certificateId}</span>
                      <span className="text-[10px]" style={{ color: "#8B8FA8" }}>{formatDate(trade.entryDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {isOpen ? (
                      currentPnlPct != null ? (
                        <div className="text-right">
                          <div className="text-sm font-bold" style={{ color: currentPnlPct >= 0 ? "#22C55E" : "#FF4D4D" }}>
                            {currentPnlPct >= 0 ? "+" : ""}{formatNumber(currentPnlPct, 1)}%
                          </div>
                          {currentPnlEur != null && (
                            <div className="text-[10px]" style={{ color: currentPnlEur >= 0 ? "#22C55E" : "#FF4D4D" }}>
                              {currentPnlEur >= 0 ? "+" : ""}{currentPnlEur.toFixed(0)} €
                            </div>
                          )}
                        </div>
                      ) : <Badge variant="accent">Offen</Badge>
                    ) : (
                      <span
                        className="text-sm font-bold"
                        style={{ color: (trade.returnPct ?? 0) >= 0 ? "#22C55E" : "#FF4D4D" }}
                      >
                        {trade.returnPct != null ? `${trade.returnPct >= 0 ? "+" : ""}${formatNumber(trade.returnPct, 1)}%` : "—"}
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      className="transition-transform"
                      style={{
                        color: "#8B8FA8",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 space-y-2.5" style={{ borderTop: "1px solid #1E1E28" }}>
                    <div className="grid grid-cols-2 gap-2 pt-2.5">
                      <div>
                        <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Stück</span>
                        <span className="text-sm text-white">{trade.quantity ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Invest.</span>
                        <span className="text-sm text-white">{investment ? `${investment.toFixed(0)} €` : "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Kurs Ein</span>
                        <span className="text-sm text-white">{trade.entryPrice != null ? `${formatNumber(trade.entryPrice, 3)} €` : "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Kurs Aus</span>
                        <span className="text-sm" style={{ color: trade.exitPrice != null ? "#fff" : "#8B8FA8" }}>
                          {trade.exitPrice != null ? `${formatNumber(trade.exitPrice, 3)} €` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>VIX Future</span>
                        <span className="text-sm text-white">{formatNumber(trade.entryVix)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Barrier</span>
                        <span className="text-sm text-white">{formatNumber(trade.barrierLevel, 2)} $</span>
                        {abstand != null && (
                          <span
                            className="text-[10px] ml-1"
                            style={{ color: abstand < 15 ? "#FF4D4D" : abstand < 30 ? "#F59E0B" : "#8B8FA8" }}
                          >
                            ({abstand.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Hebel</span>
                        <span className="text-sm" style={{ color: "#B8E15A" }}>
                          {trade.leverageRatio != null ? `×${formatNumber(trade.leverageRatio, 2)}` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Haltetage</span>
                        <span className="text-sm text-white">{trade.holdDays ?? "—"}</span>
                      </div>
                    </div>
                    {isOpen && liveBid != null && (
                      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid #1E1E28" }}>
                        <div>
                          <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Aktueller Kurs</span>
                          <span className="text-sm text-white">{formatNumber(liveBid, 3)} €</span>
                        </div>
                        {currentPnlPct != null && (
                          <div className="text-right">
                            <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Unrealisiert</span>
                            <span className="text-sm font-bold" style={{ color: currentPnlPct >= 0 ? "#22C55E" : "#FF4D4D" }}>
                              {currentPnlPct >= 0 ? "+" : ""}{formatNumber(currentPnlPct, 2)}%
                              {currentPnlEur != null && ` / ${currentPnlEur >= 0 ? "+" : ""}${currentPnlEur.toFixed(0)} €`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {trade.returnPct != null && (
                      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid #1E1E28" }}>
                        <span className="text-xs" style={{ color: "#8B8FA8" }}>Rendite</span>
                        <span className="text-sm font-bold" style={{ color: trade.returnPct >= 0 ? "#22C55E" : "#FF4D4D" }}>
                          {trade.returnPct >= 0 ? "+" : ""}{formatNumber(trade.returnPct, 2)}%
                        </span>
                      </div>
                    )}
                    {trade.notes && (
                      <p className="text-xs pt-1" style={{ color: "#8B8FA8" }}>{trade.notes}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => openEdit(trade)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
                        style={{ background: "#1E1E28", color: "#8B8FA8" }}
                      >
                        <Pencil size={12} /> Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDelete(trade.id)}
                        disabled={deleting === trade.id}
                        className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-medium"
                        style={{ background: "rgba(255,77,77,0.1)", color: "#FF4D4D" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ===== DESKTOP: Trade Table ===== */}
      <Card className="hidden lg:block">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#B8E15A] border-t-transparent" />
          </div>
        ) : trades.length === 0 ? (
          <div className="py-12 text-center">
            <p style={{ color: "#8B8FA8" }} className="mb-3">Noch keine Trades erfasst</p>
            <Button variant="primary" size="sm" onClick={openNew}>
              <Plus size={14} />
              Ersten Trade anlegen
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "#1E1E28" }}>
                  {["ISIN", "Richtung", "Datum", "Status", "Stück", "Kurs Ein", "Kurs Aus", "Invest.", "VIX Fut.", "Barrier", "Basis", "Hebel", "Rendite", "Tage", "🔔", ""].map((h) => (
                    <th key={h} className="py-3 px-2 text-left font-medium text-xs whitespace-nowrap" style={{ color: "#8B8FA8" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, i) => {
                  const investment = trade.entryPrice && trade.quantity ? trade.entryPrice * trade.quantity : null;
                  const abstand = trade.entryVix && trade.barrierLevel
                    ? ((trade.entryVix - trade.barrierLevel) / trade.entryVix * 100)
                    : null;
                  const tradeIsOpen = !trade.exitDate;
                  const tradeLiveBid = tradeIsOpen ? (livePrices[trade.certificateId]?.bid ?? null) : null;
                  const tradePnlPct = tradeLiveBid && trade.entryPrice
                    ? ((tradeLiveBid - trade.entryPrice) / trade.entryPrice) * 100 : null;
                  const tradePnlEur = tradeLiveBid && trade.entryPrice && trade.quantity
                    ? (tradeLiveBid - trade.entryPrice) * trade.quantity : null;
                  return (
                    <tr key={trade.id} className="border-b transition-colors" style={{ borderColor: "#1E1E28", background: i % 2 === 0 ? "transparent" : "#0D0D11" }}>
                      <td className="py-3 px-2 font-mono text-xs text-white whitespace-nowrap">{trade.certificateId}</td>
                      <td className="py-3 px-2">
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: trade.direction === "long" ? "rgba(59, 130, 246, 0.15)" : "rgba(255, 77, 77, 0.15)",
                            color: trade.direction === "long" ? "#3B82F6" : "#FF4D4D",
                          }}
                        >
                          {trade.direction === "long" ? "L" : "S"}
                        </span>
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap text-xs" style={{ color: "#8B8FA8" }}>{formatDate(trade.entryDate)}</td>
                      <td className="py-3 px-2">
                        {trade.exitDate
                          ? <Badge variant="muted">{formatDate(trade.exitDate)}</Badge>
                          : <Badge variant="accent">Offen</Badge>
                        }
                      </td>
                      <td className="py-3 px-2 text-white text-xs">{trade.quantity ?? "—"}</td>
                      <td className="py-3 px-2 text-white text-xs">
                        {trade.entryPrice !== null ? `${formatNumber(trade.entryPrice, 3)} €` : "—"}
                      </td>
                      <td className="py-3 px-2 text-xs" style={{ color: "#8B8FA8" }}>
                        {trade.exitPrice !== null ? `${formatNumber(trade.exitPrice, 3)} €` : "—"}
                      </td>
                      <td className="py-3 px-2 text-xs" style={{ color: "#8B8FA8" }}>
                        {investment !== null ? `${investment.toFixed(0)} €` : "—"}
                      </td>
                      <td className="py-3 px-2 text-white text-xs">
                        <div>{formatNumber(trade.entryVix)}</div>
                        {abstand !== null && (
                          <div className="text-xs" style={{ color: abstand < 15 ? "#FF4D4D" : abstand < 30 ? "#F59E0B" : "#8B8FA8" }}>
                            Abst. {abstand.toFixed(0)}%
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-xs" style={{ color: "#8B8FA8" }}>
                        {formatNumber(trade.barrierLevel, 2)} $
                      </td>
                      <td className="py-3 px-2 text-xs" style={{ color: "#8B8FA8" }}>
                        {trade.strikePrice !== null ? `${formatNumber(trade.strikePrice, 4)} $` : "—"}
                      </td>
                      <td className="py-3 px-2 text-xs">
                        {trade.leverageRatio !== null ? (
                          <span style={{ color: "#B8E15A" }}>×{formatNumber(trade.leverageRatio, 2)}</span>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-2 text-xs">
                        {tradeIsOpen && tradePnlPct != null ? (
                          <div>
                            <span style={{ color: tradePnlPct >= 0 ? "#22C55E" : "#FF4D4D" }}>
                              {tradePnlPct >= 0 ? "+" : ""}{formatNumber(tradePnlPct, 1)}%
                            </span>
                            {tradePnlEur != null && (
                              <div style={{ color: tradePnlEur >= 0 ? "#22C55E" : "#FF4D4D", fontSize: "10px" }}>
                                {tradePnlEur >= 0 ? "+" : ""}{tradePnlEur.toFixed(0)} €
                              </div>
                            )}
                          </div>
                        ) : trade.returnPct !== null ? (
                          <span style={{ color: trade.returnPct >= 0 ? "#22C55E" : "#FF4D4D" }}>
                            {formatPct(trade.returnPct)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-2 text-xs" style={{ color: "#8B8FA8" }}>{trade.holdDays ?? "—"}</td>
                      <td className="py-3 px-2">
                        {trade.alertTriggered
                          ? <Bell size={13} style={{ color: "#B8E15A" }} />
                          : <BellOff size={13} style={{ color: "#2A2A3A" }} />
                        }
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(trade)} className="rounded-lg p-1.5 transition-colors hover:bg-[#1E1E28]" style={{ color: "#8B8FA8" }}>
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleDelete(trade.id)} disabled={deleting === trade.id} className="rounded-lg p-1.5 transition-colors hover:bg-[#FF4D4D22]" style={{ color: "#FF4D4D" }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Trade Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTrade ? "Trade bearbeiten" : "Neuer Trade"} size="lg">

        {/* Section: Zertifikat */}
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8B8FA8" }}>Zertifikat</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Input
                label="ISIN"
                value={form.certificateId}
                onChange={(e) => handleIsinChange(e.target.value)}
                placeholder="z.B. DE000VJ4MNF2"
                maxLength={12}
              />
              {fetchingProduct && (
                <div className="absolute right-3 top-8 flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" style={{ color: "#B8E15A" }} />
                  <span className="text-xs" style={{ color: "#8B8FA8" }}>Lade...</span>
                </div>
              )}
              {productError && (
                <p className="text-xs mt-1" style={{ color: "#FF4D4D" }}>{productError}</p>
              )}
              {!productError && form.certificateId.length > 0 && form.certificateId.length < 12 && (
                <p className="text-xs mt-1" style={{ color: "#F59E0B" }}>
                  ISIN unvollständig ({form.certificateId.length}/12 Zeichen)
                </p>
              )}
            </div>
            <Input
              label="Einstiegs-Datum"
              type="date"
              value={form.entryDate}
              onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
            />
          </div>
          <div className="flex gap-2 mt-3">
            {(["short", "long"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => setForm({ ...form, direction: dir })}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={
                  form.direction === dir
                    ? {
                        background: dir === "short" ? "rgba(255, 77, 77, 0.15)" : "rgba(59, 130, 246, 0.15)",
                        color: dir === "short" ? "#FF4D4D" : "#3B82F6",
                        border: `1px solid ${dir === "short" ? "#FF4D4D" : "#3B82F6"}`,
                      }
                    : { background: "#1E1E28", color: "#8B8FA8", border: "1px solid #1E1E28" }
                }
              >
                {dir === "short" ? "Short VIX" : "Long VIX"}
              </button>
            ))}
          </div>
        </div>

        {/* Section: Kontrakt-Parameter */}
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8B8FA8" }}>
            Kontrakt-Parameter
            {form.certificateId.length === 12 && !fetchingProduct && !productError && form.strikePrice && (
              <span className="ml-2 font-normal normal-case" style={{ color: "#B8E15A" }}>
                — automatisch von Vontobel geladen
              </span>
            )}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Basispreis (USD)"
              type="number"
              step="0.0001"
              value={form.strikePrice}
              onChange={(e) => setForm({ ...form, strikePrice: e.target.value })}
              placeholder="z.B. 7.7257"
            />
            <Input
              label="Stop-Loss Barriere (USD)"
              type="number"
              step="0.01"
              value={form.barrierLevel}
              onChange={(e) => setForm({ ...form, barrierLevel: e.target.value })}
              placeholder="z.B. 8.70"
            />
            <Input
              label="Hebel"
              type="number"
              step="0.01"
              value={form.leverageRatio}
              onChange={(e) => setForm({ ...form, leverageRatio: e.target.value })}
              placeholder="z.B. 1.38"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Input
              label="Bezugsverhältnis"
              type="number"
              step="0.01"
              value={form.ratio}
              onChange={(e) => setForm({ ...form, ratio: e.target.value })}
              placeholder="z.B. 0.10"
            />
            <Input
              label="VIX Future bei Einstieg (USD)"
              type="number"
              step="0.01"
              value={form.entryVix}
              onChange={(e) => setForm({ ...form, entryVix: e.target.value })}
              placeholder="z.B. 25.76"
            />
            {/* Abstand zur Barrier preview */}
            <div className="flex flex-col justify-end">
              <div
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: "#1E1E28" }}
              >
                <div className="text-xs mb-1" style={{ color: "#8B8FA8" }}>Abstand zur Barrier</div>
                <div
                  className="font-semibold"
                  style={{
                    color: formAbstandBarrier
                      ? parseFloat(formAbstandBarrier) < 15 ? "#FF4D4D"
                        : parseFloat(formAbstandBarrier) < 30 ? "#F59E0B"
                        : "#22C55E"
                      : "#8B8FA8"
                  }}
                >
                  {formAbstandBarrier ? `${formAbstandBarrier}%` : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Position */}
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8B8FA8" }}>Position</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Einstiegskurs (EUR)"
              type="number"
              step="0.001"
              value={form.entryPrice}
              onChange={(e) => setForm({ ...form, entryPrice: e.target.value })}
              placeholder="z.B. 1.70"
            />
            <Input
              label="Stückzahl"
              type="number"
              step="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="z.B. 500"
            />
          </div>
          {/* Gesamtinvestition */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg px-4 py-3 text-sm flex items-center justify-between col-span-2" style={{ background: "#1E1E28", color: "#8B8FA8" }}>
              <span className="flex items-center gap-2">
                <TrendingUp size={14} />
                Gesamtinvestition
              </span>
              <span className="font-semibold text-white">
                {formInvestment ? `${formInvestment} €` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Section: Ausstieg (optional) */}
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8B8FA8" }}>Ausstieg (optional — leer = offener Trade)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Ausstiegs-Datum"
              type="date"
              value={form.exitDate}
              onChange={(e) => setForm({ ...form, exitDate: e.target.value })}
            />
            <Input
              label="Ausstiegskurs (EUR)"
              type="number"
              step="0.001"
              value={form.exitPrice}
              onChange={(e) => {
                const val = e.target.value;
                setForm((f) => ({
                  ...f,
                  exitPrice: val,
                  // Auto-set exit date to today if price is entered but date is empty
                  exitDate: val && !f.exitDate ? new Date().toISOString().split("T")[0] : f.exitDate,
                }));
              }}
              placeholder="leer lassen wenn offen"
            />
            <Input
              label="VIX Future bei Ausstieg (USD)"
              type="number"
              step="0.01"
              value={form.exitVix}
              onChange={(e) => setForm({ ...form, exitVix: e.target.value })}
              placeholder="leer lassen wenn offen"
            />
          </div>
          {/* P&L preview */}
          {formPnL !== null && (
            <div className="mt-3 rounded-lg px-4 py-3 text-sm flex items-center justify-between" style={{ background: "#1E1E28" }}>
              <span style={{ color: "#8B8FA8" }}>Realisierter P&amp;L</span>
              <span className="font-semibold" style={{ color: parseFloat(formPnL) >= 0 ? "#22C55E" : "#FF4D4D" }}>
                {parseFloat(formPnL) >= 0 ? "+" : ""}{formPnL} €
              </span>
            </div>
          )}
          <div className="mt-3">
            <Input
              label="Rendite %"
              type="number"
              step="0.01"
              value={form.returnPct}
              onChange={(e) => setForm({ ...form, returnPct: e.target.value })}
              placeholder="wird auto-berechnet aus Kursen"
            />
          </div>
        </div>

        {/* Alert + Notizen */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "#8B8FA8" }}>
              <input
                type="checkbox"
                checked={form.alertTriggered}
                onChange={(e) => setForm({ ...form, alertTriggered: e.target.checked })}
                className="w-4 h-4 rounded accent-[#B8E15A]"
              />
              Durch Alert ausgelöst
            </label>
          </div>
          <div className="col-span-2">
            <Textarea
              label="Notizen"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optionale Notizen zum Trade..."
            />
          </div>
        </div>

        {saveError && (
          <div className="mt-4 rounded-lg px-4 py-3 text-sm" style={{ background: "rgba(255,77,77,0.1)", color: "#FF4D4D", border: "1px solid rgba(255,77,77,0.2)" }}>
            {saveError}
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>Abbrechen</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {editTrade ? "Speichern" : "Anlegen"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
