// ============================================================
// VIX Trading Widget — für die Scriptable App (iOS)
//
// SETUP:
//   1. "Scriptable" kostenlos im App Store installieren
//   2. Dieses Script in Scriptable einfügen (New Script)
//   3. Widget auf dem Home Screen hinzufügen → Scriptable auswählen
//      → dieses Script wählen
// ============================================================

const BASE_URL = "https://vix-trading.de";

// ---- Farben ------------------------------------------------
const BG_COLOR      = new Color("#1C1C1E");
const TEXT_WHITE    = new Color("#FFFFFF");
const TEXT_GRAY     = new Color("#8E8E93");
const GREEN         = new Color("#30D158");
const RED           = new Color("#FF453A");
const DIVIDER_COLOR = new Color("#3A3A3C");

// ---- Daten laden ------------------------------------------
async function fetchData() {
  const url = BASE_URL + "/api/widget";
  try {
    const req = new Request(url);
    req.timeoutInterval = 15;
    const json = await req.loadJSON();
    return { ok: true, data: json, url };
  } catch (e) {
    return { ok: false, error: String(e), url };
  }
}

// ---- Hilfsfunktionen --------------------------------------
function colorForChange(pct) {
  if (pct === null || pct === undefined) return TEXT_GRAY;
  return pct >= 0 ? GREEN : RED;
}

function fmtPct(pct) {
  if (pct === null || pct === undefined) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function fmtPrice(price, symbol) {
  if (price === null || price === undefined) return "—";
  if (symbol === "ES=F" || price > 1000) {
    return price.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return price.toFixed(2);
}

// ---- Zeile für einen Markt --------------------------------
function addMarketRow(stack, symbol, price, changePct) {
  const row = stack.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  const sym = row.addText(symbol);
  sym.font = Font.boldSystemFont(15);
  sym.textColor = TEXT_WHITE;
  sym.minimumScaleFactor = 0.7;

  row.addSpacer();

  const rightStack = row.addStack();
  rightStack.layoutVertically();
  rightStack.addSpacer(1);

  const priceLabel = rightStack.addText(fmtPrice(price, symbol));
  priceLabel.font = Font.mediumSystemFont(15);
  priceLabel.textColor = TEXT_WHITE;
  priceLabel.rightAlignText();
  priceLabel.minimumScaleFactor = 0.7;

  const pctLabel = rightStack.addText(fmtPct(changePct));
  pctLabel.font = Font.mediumSystemFont(13);
  pctLabel.textColor = colorForChange(changePct);
  pctLabel.rightAlignText();

  rightStack.addSpacer(1);
}

// ---- Zeile für eine offene Position -----------------------
function addPositionRow(stack, pos) {
  const row = stack.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  const nameLabel = row.addText(pos.name || pos.direction || "Pos");
  nameLabel.font = Font.systemFont(12);
  nameLabel.textColor = TEXT_GRAY;
  nameLabel.minimumScaleFactor = 0.6;

  row.addSpacer();

  const rightStack = row.addStack();
  rightStack.layoutVertically();

  const currentLabel = rightStack.addText(pos.currentPrice != null ? pos.currentPrice.toFixed(4) : "—");
  currentLabel.font = Font.mediumSystemFont(12);
  currentLabel.textColor = TEXT_WHITE;
  currentLabel.rightAlignText();

  const pnlColor = pos.pnlPct >= 0 ? GREEN : RED;
  const pnlSign = pos.pnlPct >= 0 ? "+" : "";
  const pnlLabel = rightStack.addText(`${pnlSign}${pos.pnlPct.toFixed(2)}%`);
  pnlLabel.font = Font.mediumSystemFont(11);
  pnlLabel.textColor = pnlColor;
  pnlLabel.rightAlignText();
}

// ---- Trennlinie -------------------------------------------
function addDivider(stack) {
  const div = stack.addStack();
  div.backgroundColor = DIVIDER_COLOR;
  div.size = new Size(0, 1);
  div.addSpacer();
}

// ---- Widget aufbauen --------------------------------------
async function buildWidget(result) {
  const widget = new ListWidget();
  widget.backgroundColor = BG_COLOR;
  widget.setPadding(14, 14, 14, 14);
  widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

  // ── Fehlerfall: zeige Fehlermeldung zur Diagnose ─────────
  if (!result || !result.ok) {
    const t1 = widget.addText("⚠️ Keine Daten");
    t1.textColor = RED;
    t1.font = Font.boldSystemFont(12);

    widget.addSpacer(6);

    const t2 = widget.addText(result?.error || "Unbekannter Fehler");
    t2.textColor = TEXT_GRAY;
    t2.font = Font.systemFont(10);
    t2.minimumScaleFactor = 0.4;

    widget.addSpacer(4);

    const t3 = widget.addText(result?.url || BASE_URL);
    t3.textColor = TEXT_GRAY;
    t3.font = Font.systemFont(9);
    t3.minimumScaleFactor = 0.4;

    return widget;
  }

  const data = result.data;

  const root = widget.addStack();
  root.layoutVertically();
  root.spacing = 0;

  // Header
  const header = root.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const title = header.addText("Mein Watchlist →");
  title.font = Font.boldSystemFont(13);
  title.textColor = TEXT_WHITE;
  title.minimumScaleFactor = 0.7;

  root.addSpacer(8);

  // Marktzeilen
  const markets = data.markets || [];
  for (let i = 0; i < markets.length; i++) {
    const m = markets[i];
    addMarketRow(root, m.symbol, m.price, m.changePct);
    if (i < markets.length - 1 || (data.positions && data.positions.length > 0)) {
      root.addSpacer(6);
    }
  }

  // Offene Positionen (nur bei Medium-Widget)
  const positions = data.positions || [];
  if (positions.length > 0 && config.widgetFamily !== "small") {
    root.addSpacer(4);
    addDivider(root);
    root.addSpacer(4);

    for (const pos of positions) {
      addPositionRow(root, pos);
      root.addSpacer(4);
    }
  }

  root.addSpacer();

  // Zeitstempel unten
  const updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  const timeStr = updatedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const timeLabel = root.addText(`Stand: ${timeStr}`);
  timeLabel.font = Font.systemFont(9);
  timeLabel.textColor = TEXT_GRAY;

  return widget;
}

// ---- Main -------------------------------------------------
const result = await fetchData();
const widget = await buildWidget(result);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}

Script.complete();
