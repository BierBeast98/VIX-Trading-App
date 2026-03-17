export interface EconomicEvent {
  id: string;
  date: string;
  time?: string;
  title: string;
  type: "fed_meeting" | "fed_speech" | "cpi" | "nfp" | "consumer_confidence" | "gdp" | "ecb_meeting" | "boe_meeting" | "boj_meeting" | "pmi" | "ifo" | "zew" | "other";
  impact: "high" | "medium" | "low";
  description?: string;
  country: string;
  historicalVixImpact?: number;
}

// 2026 Economic Calendar — key events
const CALENDAR_2026: EconomicEvent[] = [
  // FOMC Meetings 2026
  { id: "fomc-2026-01", date: "2026-01-28", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-03", date: "2026-03-18", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-05", date: "2026-05-06", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-06", date: "2026-06-17", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-07", date: "2026-07-29", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-09", date: "2026-09-16", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-11", date: "2026-11-04", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-12", date: "2026-12-16", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },

  // CPI 2026 (approx — 2nd week of each month)
  { id: "cpi-2026-01", date: "2026-01-15", time: "14:30", title: "US CPI (Dez)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index — Kernrate und Gesamt", historicalVixImpact: 1.8 },
  { id: "cpi-2026-02", date: "2026-02-12", time: "14:30", title: "US CPI (Jan)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-03", date: "2026-03-11", time: "14:30", title: "US CPI (Feb)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-04", date: "2026-04-10", time: "14:30", title: "US CPI (Mär)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-05", date: "2026-05-13", time: "14:30", title: "US CPI (Apr)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-06", date: "2026-06-10", time: "14:30", title: "US CPI (Mai)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },

  // NFP 2026 (1st Friday of month)
  { id: "nfp-2026-02", date: "2026-02-06", time: "14:30", title: "Non-Farm Payrolls (Jan)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-03", date: "2026-03-06", time: "14:30", title: "Non-Farm Payrolls (Feb)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-04", date: "2026-04-03", time: "14:30", title: "Non-Farm Payrolls (Mär)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-05", date: "2026-05-01", time: "14:30", title: "Non-Farm Payrolls (Apr)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-06", date: "2026-06-05", time: "14:30", title: "Non-Farm Payrolls (Mai)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-07", date: "2026-07-02", time: "14:30", title: "Non-Farm Payrolls (Jun)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-08", date: "2026-08-07", time: "14:30", title: "Non-Farm Payrolls (Jul)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-09", date: "2026-09-04", time: "14:30", title: "Non-Farm Payrolls (Aug)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-10", date: "2026-10-02", time: "14:30", title: "Non-Farm Payrolls (Sep)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-11", date: "2026-11-06", time: "14:30", title: "Non-Farm Payrolls (Okt)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-12", date: "2026-12-04", time: "14:30", title: "Non-Farm Payrolls (Nov)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },

  // US CPI (additional months)
  { id: "cpi-2026-07", date: "2026-07-14", time: "14:30", title: "US CPI (Jun)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-08", date: "2026-08-12", time: "14:30", title: "US CPI (Jul)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-09", date: "2026-09-11", time: "14:30", title: "US CPI (Aug)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-10", date: "2026-10-14", time: "14:30", title: "US CPI (Sep)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-11", date: "2026-11-12", time: "14:30", title: "US CPI (Okt)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-12", date: "2026-12-10", time: "14:30", title: "US CPI (Nov)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },

  // ─── EZB / Eurozone ───────────────────────────────────────────────────────
  // ECB Zinsentscheidungen 2026 (8 Sitzungen, 14:15 Uhr CET)
  { id: "ecb-2026-01", date: "2026-01-30", time: "14:15", title: "EZB Zinsentscheidung", type: "ecb_meeting", impact: "high", country: "EU", description: "Europäische Zentralbank – Zinsentscheidung & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-03", date: "2026-03-06", time: "14:15", title: "EZB Zinsentscheidung", type: "ecb_meeting", impact: "high", country: "EU", description: "Europäische Zentralbank – Zinsentscheidung & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-04", date: "2026-04-17", time: "14:15", title: "EZB Zinsentscheidung", type: "ecb_meeting", impact: "high", country: "EU", description: "Europäische Zentralbank – Zinsentscheidung & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-06", date: "2026-06-05", time: "14:15", title: "EZB Zinsentscheidung", type: "ecb_meeting", impact: "high", country: "EU", description: "Europäische Zentralbank – Zinsentscheidung & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-07", date: "2026-07-24", time: "14:15", title: "EZB Zinsentscheidung", type: "ecb_meeting", impact: "high", country: "EU", description: "Europäische Zentralbank – Zinsentscheidung & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-09", date: "2026-09-11", time: "14:15", title: "EZB Zinsentscheidung", type: "ecb_meeting", impact: "high", country: "EU", description: "Europäische Zentralbank – Zinsentscheidung & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-10", date: "2026-10-23", time: "14:15", title: "EZB Zinsentscheidung", type: "ecb_meeting", impact: "high", country: "EU", description: "Europäische Zentralbank – Zinsentscheidung & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-12", date: "2026-12-11", time: "14:15", title: "EZB Zinsentscheidung", type: "ecb_meeting", impact: "high", country: "EU", description: "Europäische Zentralbank – Zinsentscheidung & Pressekonferenz", historicalVixImpact: 1.2 },

  // Eurozone CPI Flash-Schätzung (monatlich, Anfang des Folgemonats, 11:00 CET)
  { id: "eu-cpi-2026-01", date: "2026-01-07", time: "11:00", title: "Eurozone VPI Flash (Dez)", type: "cpi", impact: "medium", country: "EU", description: "Eurostat Verbraucherpreisindex – Schnellschätzung", historicalVixImpact: 0.6 },
  { id: "eu-cpi-2026-02", date: "2026-02-04", time: "11:00", title: "Eurozone VPI Flash (Jan)", type: "cpi", impact: "medium", country: "EU", description: "Eurostat Verbraucherpreisindex – Schnellschätzung", historicalVixImpact: 0.6 },
  { id: "eu-cpi-2026-03", date: "2026-03-04", time: "11:00", title: "Eurozone VPI Flash (Feb)", type: "cpi", impact: "medium", country: "EU", description: "Eurostat Verbraucherpreisindex – Schnellschätzung", historicalVixImpact: 0.6 },
  { id: "eu-cpi-2026-04", date: "2026-04-01", time: "11:00", title: "Eurozone VPI Flash (Mär)", type: "cpi", impact: "medium", country: "EU", description: "Eurostat Verbraucherpreisindex – Schnellschätzung", historicalVixImpact: 0.6 },
  { id: "eu-cpi-2026-05", date: "2026-05-06", time: "11:00", title: "Eurozone VPI Flash (Apr)", type: "cpi", impact: "medium", country: "EU", description: "Eurostat Verbraucherpreisindex – Schnellschätzung", historicalVixImpact: 0.6 },
  { id: "eu-cpi-2026-06", date: "2026-06-03", time: "11:00", title: "Eurozone VPI Flash (Mai)", type: "cpi", impact: "medium", country: "EU", description: "Eurostat Verbraucherpreisindex – Schnellschätzung", historicalVixImpact: 0.6 },
  { id: "eu-cpi-2026-07", date: "2026-07-01", time: "11:00", title: "Eurozone VPI Flash (Jun)", type: "cpi", impact: "medium", country: "EU", description: "Eurostat Verbraucherpreisindex – Schnellschätzung", historicalVixImpact: 0.6 },
  { id: "eu-cpi-2026-08", date: "2026-08-05", time: "11:00", title: "Eurozone VPI Flash (Jul)", type: "cpi", impact: "medium", country: "EU", description: "Eurostat Verbraucherpreisindex – Schnellschätzung", historicalVixImpact: 0.6 },
  { id: "eu-cpi-2026-09", date: "2026-09-02", time: "11:00", title: "Eurozone VPI Flash (Aug)", type: "cpi", impact: "medium", country: "EU", description: "Eurostat Verbraucherpreisindex – Schnellschätzung", historicalVixImpact: 0.6 },
  { id: "eu-cpi-2026-10", date: "2026-10-07", time: "11:00", title: "Eurozone VPI Flash (Sep)", type: "cpi", impact: "medium", country: "EU", description: "Eurostat Verbraucherpreisindex – Schnellschätzung", historicalVixImpact: 0.6 },
  { id: "eu-cpi-2026-11", date: "2026-11-04", time: "11:00", title: "Eurozone VPI Flash (Okt)", type: "cpi", impact: "medium", country: "EU", description: "Eurostat Verbraucherpreisindex – Schnellschätzung", historicalVixImpact: 0.6 },
  { id: "eu-cpi-2026-12", date: "2026-12-02", time: "11:00", title: "Eurozone VPI Flash (Nov)", type: "cpi", impact: "medium", country: "EU", description: "Eurostat Verbraucherpreisindex – Schnellschätzung", historicalVixImpact: 0.6 },

  // Deutschland – IFO Geschäftsklimaindex (letzter Donnerstag des Monats, 10:00 CET)
  { id: "ifo-2026-01", date: "2026-01-29", time: "10:00", title: "Ifo Geschäftsklimaindex (Jan)", type: "ifo", impact: "medium", country: "DE", description: "ifo Institut – Geschäftsklima, Lage & Erwartungen", historicalVixImpact: 0.4 },
  { id: "ifo-2026-02", date: "2026-02-26", time: "10:00", title: "Ifo Geschäftsklimaindex (Feb)", type: "ifo", impact: "medium", country: "DE", description: "ifo Institut – Geschäftsklima, Lage & Erwartungen", historicalVixImpact: 0.4 },
  { id: "ifo-2026-03", date: "2026-03-26", time: "10:00", title: "Ifo Geschäftsklimaindex (Mär)", type: "ifo", impact: "medium", country: "DE", description: "ifo Institut – Geschäftsklima, Lage & Erwartungen", historicalVixImpact: 0.4 },
  { id: "ifo-2026-04", date: "2026-04-28", time: "10:00", title: "Ifo Geschäftsklimaindex (Apr)", type: "ifo", impact: "medium", country: "DE", description: "ifo Institut – Geschäftsklima, Lage & Erwartungen", historicalVixImpact: 0.4 },
  { id: "ifo-2026-05", date: "2026-05-28", time: "10:00", title: "Ifo Geschäftsklimaindex (Mai)", type: "ifo", impact: "medium", country: "DE", description: "ifo Institut – Geschäftsklima, Lage & Erwartungen", historicalVixImpact: 0.4 },
  { id: "ifo-2026-06", date: "2026-06-25", time: "10:00", title: "Ifo Geschäftsklimaindex (Jun)", type: "ifo", impact: "medium", country: "DE", description: "ifo Institut – Geschäftsklima, Lage & Erwartungen", historicalVixImpact: 0.4 },
  { id: "ifo-2026-07", date: "2026-07-30", time: "10:00", title: "Ifo Geschäftsklimaindex (Jul)", type: "ifo", impact: "medium", country: "DE", description: "ifo Institut – Geschäftsklima, Lage & Erwartungen", historicalVixImpact: 0.4 },
  { id: "ifo-2026-08", date: "2026-08-27", time: "10:00", title: "Ifo Geschäftsklimaindex (Aug)", type: "ifo", impact: "medium", country: "DE", description: "ifo Institut – Geschäftsklima, Lage & Erwartungen", historicalVixImpact: 0.4 },
  { id: "ifo-2026-09", date: "2026-09-24", time: "10:00", title: "Ifo Geschäftsklimaindex (Sep)", type: "ifo", impact: "medium", country: "DE", description: "ifo Institut – Geschäftsklima, Lage & Erwartungen", historicalVixImpact: 0.4 },
  { id: "ifo-2026-10", date: "2026-10-29", time: "10:00", title: "Ifo Geschäftsklimaindex (Okt)", type: "ifo", impact: "medium", country: "DE", description: "ifo Institut – Geschäftsklima, Lage & Erwartungen", historicalVixImpact: 0.4 },
  { id: "ifo-2026-11", date: "2026-11-26", time: "10:00", title: "Ifo Geschäftsklimaindex (Nov)", type: "ifo", impact: "medium", country: "DE", description: "ifo Institut – Geschäftsklima, Lage & Erwartungen", historicalVixImpact: 0.4 },
  { id: "ifo-2026-12", date: "2026-12-17", time: "10:00", title: "Ifo Geschäftsklimaindex (Dez)", type: "ifo", impact: "medium", country: "DE", description: "ifo Institut – Geschäftsklima, Lage & Erwartungen", historicalVixImpact: 0.4 },

  // Deutschland – ZEW Konjunkturerwartungen (2. Dienstag des Monats, 11:00 CET)
  { id: "zew-2026-01", date: "2026-01-20", time: "11:00", title: "ZEW Konjunkturerwartungen (Jan)", type: "zew", impact: "medium", country: "DE", description: "ZEW – Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.3 },
  { id: "zew-2026-02", date: "2026-02-17", time: "11:00", title: "ZEW Konjunkturerwartungen (Feb)", type: "zew", impact: "medium", country: "DE", description: "ZEW – Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.3 },
  { id: "zew-2026-03", date: "2026-03-17", time: "11:00", title: "ZEW Konjunkturerwartungen (Mär)", type: "zew", impact: "medium", country: "DE", description: "ZEW – Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.3 },
  { id: "zew-2026-04", date: "2026-04-14", time: "11:00", title: "ZEW Konjunkturerwartungen (Apr)", type: "zew", impact: "medium", country: "DE", description: "ZEW – Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.3 },
  { id: "zew-2026-05", date: "2026-05-12", time: "11:00", title: "ZEW Konjunkturerwartungen (Mai)", type: "zew", impact: "medium", country: "DE", description: "ZEW – Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.3 },
  { id: "zew-2026-06", date: "2026-06-09", time: "11:00", title: "ZEW Konjunkturerwartungen (Jun)", type: "zew", impact: "medium", country: "DE", description: "ZEW – Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.3 },
  { id: "zew-2026-07", date: "2026-07-14", time: "11:00", title: "ZEW Konjunkturerwartungen (Jul)", type: "zew", impact: "medium", country: "DE", description: "ZEW – Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.3 },
  { id: "zew-2026-08", date: "2026-08-11", time: "11:00", title: "ZEW Konjunkturerwartungen (Aug)", type: "zew", impact: "medium", country: "DE", description: "ZEW – Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.3 },
  { id: "zew-2026-09", date: "2026-09-08", time: "11:00", title: "ZEW Konjunkturerwartungen (Sep)", type: "zew", impact: "medium", country: "DE", description: "ZEW – Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.3 },
  { id: "zew-2026-10", date: "2026-10-13", time: "11:00", title: "ZEW Konjunkturerwartungen (Okt)", type: "zew", impact: "medium", country: "DE", description: "ZEW – Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.3 },
  { id: "zew-2026-11", date: "2026-11-10", time: "11:00", title: "ZEW Konjunkturerwartungen (Nov)", type: "zew", impact: "medium", country: "DE", description: "ZEW – Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.3 },
  { id: "zew-2026-12", date: "2026-12-08", time: "11:00", title: "ZEW Konjunkturerwartungen (Dez)", type: "zew", impact: "medium", country: "DE", description: "ZEW – Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.3 },

  // ─── Großbritannien / Bank of England ────────────────────────────────────
  // BOE MPC Zinsentscheidungen 2026 (8 Sitzungen, 13:00 CET)
  { id: "boe-2026-02", date: "2026-02-05", time: "13:00", title: "BoE Zinsentscheidung", type: "boe_meeting", impact: "high", country: "GB", description: "Bank of England MPC – Zinsentscheidung & Monetary Policy Report", historicalVixImpact: 0.8 },
  { id: "boe-2026-03", date: "2026-03-19", time: "13:00", title: "BoE Zinsentscheidung", type: "boe_meeting", impact: "high", country: "GB", description: "Bank of England MPC – Zinsentscheidung", historicalVixImpact: 0.8 },
  { id: "boe-2026-05", date: "2026-05-07", time: "13:00", title: "BoE Zinsentscheidung", type: "boe_meeting", impact: "high", country: "GB", description: "Bank of England MPC – Zinsentscheidung & Monetary Policy Report", historicalVixImpact: 0.8 },
  { id: "boe-2026-06", date: "2026-06-18", time: "13:00", title: "BoE Zinsentscheidung", type: "boe_meeting", impact: "high", country: "GB", description: "Bank of England MPC – Zinsentscheidung", historicalVixImpact: 0.8 },
  { id: "boe-2026-08", date: "2026-08-06", time: "13:00", title: "BoE Zinsentscheidung", type: "boe_meeting", impact: "high", country: "GB", description: "Bank of England MPC – Zinsentscheidung & Monetary Policy Report", historicalVixImpact: 0.8 },
  { id: "boe-2026-09", date: "2026-09-17", time: "13:00", title: "BoE Zinsentscheidung", type: "boe_meeting", impact: "high", country: "GB", description: "Bank of England MPC – Zinsentscheidung", historicalVixImpact: 0.8 },
  { id: "boe-2026-11", date: "2026-11-05", time: "13:00", title: "BoE Zinsentscheidung", type: "boe_meeting", impact: "high", country: "GB", description: "Bank of England MPC – Zinsentscheidung & Monetary Policy Report", historicalVixImpact: 0.8 },
  { id: "boe-2026-12", date: "2026-12-17", time: "13:00", title: "BoE Zinsentscheidung", type: "boe_meeting", impact: "high", country: "GB", description: "Bank of England MPC – Zinsentscheidung", historicalVixImpact: 0.8 },

  // UK CPI (3. Mittwoch des Monats, 08:00 CET)
  { id: "uk-cpi-2026-01", date: "2026-01-15", time: "08:00", title: "UK VPI (Dez)", type: "cpi", impact: "medium", country: "GB", description: "ONS Verbraucherpreisindex Großbritannien", historicalVixImpact: 0.5 },
  { id: "uk-cpi-2026-02", date: "2026-02-19", time: "08:00", title: "UK VPI (Jan)", type: "cpi", impact: "medium", country: "GB", description: "ONS Verbraucherpreisindex Großbritannien", historicalVixImpact: 0.5 },
  { id: "uk-cpi-2026-03", date: "2026-03-19", time: "08:00", title: "UK VPI (Feb)", type: "cpi", impact: "medium", country: "GB", description: "ONS Verbraucherpreisindex Großbritannien", historicalVixImpact: 0.5 },
  { id: "uk-cpi-2026-04", date: "2026-04-16", time: "08:00", title: "UK VPI (Mär)", type: "cpi", impact: "medium", country: "GB", description: "ONS Verbraucherpreisindex Großbritannien", historicalVixImpact: 0.5 },
  { id: "uk-cpi-2026-05", date: "2026-05-21", time: "08:00", title: "UK VPI (Apr)", type: "cpi", impact: "medium", country: "GB", description: "ONS Verbraucherpreisindex Großbritannien", historicalVixImpact: 0.5 },
  { id: "uk-cpi-2026-06", date: "2026-06-18", time: "08:00", title: "UK VPI (Mai)", type: "cpi", impact: "medium", country: "GB", description: "ONS Verbraucherpreisindex Großbritannien", historicalVixImpact: 0.5 },
  { id: "uk-cpi-2026-07", date: "2026-07-16", time: "08:00", title: "UK VPI (Jun)", type: "cpi", impact: "medium", country: "GB", description: "ONS Verbraucherpreisindex Großbritannien", historicalVixImpact: 0.5 },
  { id: "uk-cpi-2026-08", date: "2026-08-20", time: "08:00", title: "UK VPI (Jul)", type: "cpi", impact: "medium", country: "GB", description: "ONS Verbraucherpreisindex Großbritannien", historicalVixImpact: 0.5 },
  { id: "uk-cpi-2026-09", date: "2026-09-17", time: "08:00", title: "UK VPI (Aug)", type: "cpi", impact: "medium", country: "GB", description: "ONS Verbraucherpreisindex Großbritannien", historicalVixImpact: 0.5 },
  { id: "uk-cpi-2026-10", date: "2026-10-15", time: "08:00", title: "UK VPI (Sep)", type: "cpi", impact: "medium", country: "GB", description: "ONS Verbraucherpreisindex Großbritannien", historicalVixImpact: 0.5 },
  { id: "uk-cpi-2026-11", date: "2026-11-19", time: "08:00", title: "UK VPI (Okt)", type: "cpi", impact: "medium", country: "GB", description: "ONS Verbraucherpreisindex Großbritannien", historicalVixImpact: 0.5 },
  { id: "uk-cpi-2026-12", date: "2026-12-17", time: "08:00", title: "UK VPI (Nov)", type: "cpi", impact: "medium", country: "GB", description: "ONS Verbraucherpreisindex Großbritannien", historicalVixImpact: 0.5 },

  // UK BIP (vierteljährlich, vorläufig)
  { id: "uk-gdp-2026-q4", date: "2026-02-12", time: "08:00", title: "UK BIP Q4 2025 (vorläufig)", type: "gdp", impact: "medium", country: "GB", description: "ONS – Bruttoinlandsprodukt Großbritannien, Erstschätzung", historicalVixImpact: 0.5 },
  { id: "uk-gdp-2026-q1", date: "2026-05-13", time: "08:00", title: "UK BIP Q1 2026 (vorläufig)", type: "gdp", impact: "medium", country: "GB", description: "ONS – Bruttoinlandsprodukt Großbritannien, Erstschätzung", historicalVixImpact: 0.5 },
  { id: "uk-gdp-2026-q2", date: "2026-08-12", time: "08:00", title: "UK BIP Q2 2026 (vorläufig)", type: "gdp", impact: "medium", country: "GB", description: "ONS – Bruttoinlandsprodukt Großbritannien, Erstschätzung", historicalVixImpact: 0.5 },
  { id: "uk-gdp-2026-q3", date: "2026-11-12", time: "08:00", title: "UK BIP Q3 2026 (vorläufig)", type: "gdp", impact: "medium", country: "GB", description: "ONS – Bruttoinlandsprodukt Großbritannien, Erstschätzung", historicalVixImpact: 0.5 },

  // ─── Japan / Bank of Japan ────────────────────────────────────────────────
  // BOJ Zinsentscheidungen 2026 (8 Sitzungen, ~04:00 CET)
  { id: "boj-2026-01", date: "2026-01-24", time: "04:00", title: "BoJ Zinsentscheidung", type: "boj_meeting", impact: "high", country: "JP", description: "Bank of Japan – Geldpolitische Entscheidung & Outlook Report", historicalVixImpact: 1.0 },
  { id: "boj-2026-03", date: "2026-03-19", time: "04:00", title: "BoJ Zinsentscheidung", type: "boj_meeting", impact: "high", country: "JP", description: "Bank of Japan – Geldpolitische Entscheidung", historicalVixImpact: 1.0 },
  { id: "boj-2026-05", date: "2026-05-01", time: "04:00", title: "BoJ Zinsentscheidung", type: "boj_meeting", impact: "high", country: "JP", description: "Bank of Japan – Geldpolitische Entscheidung & Outlook Report", historicalVixImpact: 1.0 },
  { id: "boj-2026-06", date: "2026-06-17", time: "04:00", title: "BoJ Zinsentscheidung", type: "boj_meeting", impact: "high", country: "JP", description: "Bank of Japan – Geldpolitische Entscheidung", historicalVixImpact: 1.0 },
  { id: "boj-2026-07", date: "2026-07-31", time: "04:00", title: "BoJ Zinsentscheidung", type: "boj_meeting", impact: "high", country: "JP", description: "Bank of Japan – Geldpolitische Entscheidung & Outlook Report", historicalVixImpact: 1.0 },
  { id: "boj-2026-09", date: "2026-09-22", time: "04:00", title: "BoJ Zinsentscheidung", type: "boj_meeting", impact: "high", country: "JP", description: "Bank of Japan – Geldpolitische Entscheidung", historicalVixImpact: 1.0 },
  { id: "boj-2026-10", date: "2026-10-30", time: "04:00", title: "BoJ Zinsentscheidung", type: "boj_meeting", impact: "high", country: "JP", description: "Bank of Japan – Geldpolitische Entscheidung & Outlook Report", historicalVixImpact: 1.0 },
  { id: "boj-2026-12", date: "2026-12-19", time: "04:00", title: "BoJ Zinsentscheidung", type: "boj_meeting", impact: "high", country: "JP", description: "Bank of Japan – Geldpolitische Entscheidung", historicalVixImpact: 1.0 },

  // Japan VPI (monatlich, 3. Freitag des Monats, ~00:30 CET)
  { id: "jp-cpi-2026-01", date: "2026-01-23", time: "00:30", title: "Japan VPI (Dez)", type: "cpi", impact: "medium", country: "JP", description: "Japanischer Verbraucherpreisindex (nationaler VPI)", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-02", date: "2026-02-20", time: "00:30", title: "Japan VPI (Jan)", type: "cpi", impact: "medium", country: "JP", description: "Japanischer Verbraucherpreisindex (nationaler VPI)", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-03", date: "2026-03-20", time: "00:30", title: "Japan VPI (Feb)", type: "cpi", impact: "medium", country: "JP", description: "Japanischer Verbraucherpreisindex (nationaler VPI)", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-04", date: "2026-04-17", time: "00:30", title: "Japan VPI (Mär)", type: "cpi", impact: "medium", country: "JP", description: "Japanischer Verbraucherpreisindex (nationaler VPI)", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-05", date: "2026-05-22", time: "00:30", title: "Japan VPI (Apr)", type: "cpi", impact: "medium", country: "JP", description: "Japanischer Verbraucherpreisindex (nationaler VPI)", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-06", date: "2026-06-19", time: "00:30", title: "Japan VPI (Mai)", type: "cpi", impact: "medium", country: "JP", description: "Japanischer Verbraucherpreisindex (nationaler VPI)", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-07", date: "2026-07-24", time: "00:30", title: "Japan VPI (Jun)", type: "cpi", impact: "medium", country: "JP", description: "Japanischer Verbraucherpreisindex (nationaler VPI)", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-08", date: "2026-08-21", time: "00:30", title: "Japan VPI (Jul)", type: "cpi", impact: "medium", country: "JP", description: "Japanischer Verbraucherpreisindex (nationaler VPI)", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-09", date: "2026-09-18", time: "00:30", title: "Japan VPI (Aug)", type: "cpi", impact: "medium", country: "JP", description: "Japanischer Verbraucherpreisindex (nationaler VPI)", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-10", date: "2026-10-23", time: "00:30", title: "Japan VPI (Sep)", type: "cpi", impact: "medium", country: "JP", description: "Japanischer Verbraucherpreisindex (nationaler VPI)", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-11", date: "2026-11-20", time: "00:30", title: "Japan VPI (Okt)", type: "cpi", impact: "medium", country: "JP", description: "Japanischer Verbraucherpreisindex (nationaler VPI)", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-12", date: "2026-12-18", time: "00:30", title: "Japan VPI (Nov)", type: "cpi", impact: "medium", country: "JP", description: "Japanischer Verbraucherpreisindex (nationaler VPI)", historicalVixImpact: 0.4 },

  // Japan BIP (vierteljährlich, vorläufig, ~01:50 CET)
  { id: "jp-gdp-2026-q4", date: "2026-02-16", time: "01:50", title: "Japan BIP Q4 2025 (vorläufig)", type: "gdp", impact: "medium", country: "JP", description: "Japanisches BIP – Erstschätzung (Cabinet Office)", historicalVixImpact: 0.4 },
  { id: "jp-gdp-2026-q1", date: "2026-05-18", time: "01:50", title: "Japan BIP Q1 2026 (vorläufig)", type: "gdp", impact: "medium", country: "JP", description: "Japanisches BIP – Erstschätzung (Cabinet Office)", historicalVixImpact: 0.4 },
  { id: "jp-gdp-2026-q2", date: "2026-08-17", time: "01:50", title: "Japan BIP Q2 2026 (vorläufig)", type: "gdp", impact: "medium", country: "JP", description: "Japanisches BIP – Erstschätzung (Cabinet Office)", historicalVixImpact: 0.4 },
  { id: "jp-gdp-2026-q3", date: "2026-11-16", time: "01:50", title: "Japan BIP Q3 2026 (vorläufig)", type: "gdp", impact: "medium", country: "JP", description: "Japanisches BIP – Erstschätzung (Cabinet Office)", historicalVixImpact: 0.4 },

  // ─── China ────────────────────────────────────────────────────────────────
  // China BIP (vierteljährlich, NBS, ~03:00 CET)
  { id: "cn-gdp-2026-q4", date: "2026-01-17", time: "03:00", title: "China BIP Q4 2025", type: "gdp", impact: "high", country: "CN", description: "NBS – Chinesisches Bruttoinlandsprodukt (jährlich & quartalsbezogen)", historicalVixImpact: 0.8 },
  { id: "cn-gdp-2026-q1", date: "2026-04-16", time: "03:00", title: "China BIP Q1 2026", type: "gdp", impact: "high", country: "CN", description: "NBS – Chinesisches Bruttoinlandsprodukt (jährlich & quartalsbezogen)", historicalVixImpact: 0.8 },
  { id: "cn-gdp-2026-q2", date: "2026-07-15", time: "03:00", title: "China BIP Q2 2026", type: "gdp", impact: "high", country: "CN", description: "NBS – Chinesisches Bruttoinlandsprodukt (jährlich & quartalsbezogen)", historicalVixImpact: 0.8 },
  { id: "cn-gdp-2026-q3", date: "2026-10-14", time: "03:00", title: "China BIP Q3 2026", type: "gdp", impact: "high", country: "CN", description: "NBS – Chinesisches Bruttoinlandsprodukt (jährlich & quartalsbezogen)", historicalVixImpact: 0.8 },

  // China VPI (monatlich, NBS, ~02:30 CET)
  { id: "cn-cpi-2026-01", date: "2026-01-09", time: "02:30", title: "China VPI (Dez)", type: "cpi", impact: "medium", country: "CN", description: "NBS – Chinesischer Verbraucherpreisindex", historicalVixImpact: 0.5 },
  { id: "cn-cpi-2026-02", date: "2026-02-13", time: "02:30", title: "China VPI (Jan)", type: "cpi", impact: "medium", country: "CN", description: "NBS – Chinesischer Verbraucherpreisindex", historicalVixImpact: 0.5 },
  { id: "cn-cpi-2026-03", date: "2026-03-09", time: "02:30", title: "China VPI (Feb)", type: "cpi", impact: "medium", country: "CN", description: "NBS – Chinesischer Verbraucherpreisindex", historicalVixImpact: 0.5 },
  { id: "cn-cpi-2026-04", date: "2026-04-10", time: "02:30", title: "China VPI (Mär)", type: "cpi", impact: "medium", country: "CN", description: "NBS – Chinesischer Verbraucherpreisindex", historicalVixImpact: 0.5 },
  { id: "cn-cpi-2026-05", date: "2026-05-11", time: "02:30", title: "China VPI (Apr)", type: "cpi", impact: "medium", country: "CN", description: "NBS – Chinesischer Verbraucherpreisindex", historicalVixImpact: 0.5 },
  { id: "cn-cpi-2026-06", date: "2026-06-10", time: "02:30", title: "China VPI (Mai)", type: "cpi", impact: "medium", country: "CN", description: "NBS – Chinesischer Verbraucherpreisindex", historicalVixImpact: 0.5 },
  { id: "cn-cpi-2026-07", date: "2026-07-09", time: "02:30", title: "China VPI (Jun)", type: "cpi", impact: "medium", country: "CN", description: "NBS – Chinesischer Verbraucherpreisindex", historicalVixImpact: 0.5 },
  { id: "cn-cpi-2026-08", date: "2026-08-10", time: "02:30", title: "China VPI (Jul)", type: "cpi", impact: "medium", country: "CN", description: "NBS – Chinesischer Verbraucherpreisindex", historicalVixImpact: 0.5 },
  { id: "cn-cpi-2026-09", date: "2026-09-10", time: "02:30", title: "China VPI (Aug)", type: "cpi", impact: "medium", country: "CN", description: "NBS – Chinesischer Verbraucherpreisindex", historicalVixImpact: 0.5 },
  { id: "cn-cpi-2026-10", date: "2026-10-12", time: "02:30", title: "China VPI (Sep)", type: "cpi", impact: "medium", country: "CN", description: "NBS – Chinesischer Verbraucherpreisindex", historicalVixImpact: 0.5 },
  { id: "cn-cpi-2026-11", date: "2026-11-10", time: "02:30", title: "China VPI (Okt)", type: "cpi", impact: "medium", country: "CN", description: "NBS – Chinesischer Verbraucherpreisindex", historicalVixImpact: 0.5 },
  { id: "cn-cpi-2026-12", date: "2026-12-09", time: "02:30", title: "China VPI (Nov)", type: "cpi", impact: "medium", country: "CN", description: "NBS – Chinesischer Verbraucherpreisindex", historicalVixImpact: 0.5 },

  // China PMI Verarbeitendes Gewerbe NBS (letzter Tag des Monats, ~02:30 CET)
  { id: "cn-pmi-2026-01", date: "2026-01-31", time: "02:30", title: "China PMI Verarbeitendes Gewerbe (Jan)", type: "pmi", impact: "medium", country: "CN", description: "NBS Einkaufsmanagerindex – Verarbeitendes Gewerbe", historicalVixImpact: 0.6 },
  { id: "cn-pmi-2026-02", date: "2026-02-28", time: "02:30", title: "China PMI Verarbeitendes Gewerbe (Feb)", type: "pmi", impact: "medium", country: "CN", description: "NBS Einkaufsmanagerindex – Verarbeitendes Gewerbe", historicalVixImpact: 0.6 },
  { id: "cn-pmi-2026-03", date: "2026-03-31", time: "02:30", title: "China PMI Verarbeitendes Gewerbe (Mär)", type: "pmi", impact: "medium", country: "CN", description: "NBS Einkaufsmanagerindex – Verarbeitendes Gewerbe", historicalVixImpact: 0.6 },
  { id: "cn-pmi-2026-04", date: "2026-04-30", time: "02:30", title: "China PMI Verarbeitendes Gewerbe (Apr)", type: "pmi", impact: "medium", country: "CN", description: "NBS Einkaufsmanagerindex – Verarbeitendes Gewerbe", historicalVixImpact: 0.6 },
  { id: "cn-pmi-2026-05", date: "2026-05-29", time: "02:30", title: "China PMI Verarbeitendes Gewerbe (Mai)", type: "pmi", impact: "medium", country: "CN", description: "NBS Einkaufsmanagerindex – Verarbeitendes Gewerbe", historicalVixImpact: 0.6 },
  { id: "cn-pmi-2026-06", date: "2026-06-30", time: "02:30", title: "China PMI Verarbeitendes Gewerbe (Jun)", type: "pmi", impact: "medium", country: "CN", description: "NBS Einkaufsmanagerindex – Verarbeitendes Gewerbe", historicalVixImpact: 0.6 },
  { id: "cn-pmi-2026-07", date: "2026-07-31", time: "02:30", title: "China PMI Verarbeitendes Gewerbe (Jul)", type: "pmi", impact: "medium", country: "CN", description: "NBS Einkaufsmanagerindex – Verarbeitendes Gewerbe", historicalVixImpact: 0.6 },
  { id: "cn-pmi-2026-08", date: "2026-08-31", time: "02:30", title: "China PMI Verarbeitendes Gewerbe (Aug)", type: "pmi", impact: "medium", country: "CN", description: "NBS Einkaufsmanagerindex – Verarbeitendes Gewerbe", historicalVixImpact: 0.6 },
  { id: "cn-pmi-2026-09", date: "2026-09-30", time: "02:30", title: "China PMI Verarbeitendes Gewerbe (Sep)", type: "pmi", impact: "medium", country: "CN", description: "NBS Einkaufsmanagerindex – Verarbeitendes Gewerbe", historicalVixImpact: 0.6 },
  { id: "cn-pmi-2026-10", date: "2026-10-31", time: "02:30", title: "China PMI Verarbeitendes Gewerbe (Okt)", type: "pmi", impact: "medium", country: "CN", description: "NBS Einkaufsmanagerindex – Verarbeitendes Gewerbe", historicalVixImpact: 0.6 },
  { id: "cn-pmi-2026-11", date: "2026-11-30", time: "02:30", title: "China PMI Verarbeitendes Gewerbe (Nov)", type: "pmi", impact: "medium", country: "CN", description: "NBS Einkaufsmanagerindex – Verarbeitendes Gewerbe", historicalVixImpact: 0.6 },
  { id: "cn-pmi-2026-12", date: "2026-12-31", time: "02:30", title: "China PMI Verarbeitendes Gewerbe (Dez)", type: "pmi", impact: "medium", country: "CN", description: "NBS Einkaufsmanagerindex – Verarbeitendes Gewerbe", historicalVixImpact: 0.6 },
];

export function getUpcomingEvents(days = 30): EconomicEvent[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return CALENDAR_2026
    .filter((e) => {
      const d = new Date(e.date);
      return d >= now && d <= cutoff;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getEventsForMonth(year: number, month: number): EconomicEvent[] {
  return CALENDAR_2026
    .filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getAllEvents(): EconomicEvent[] {
  return CALENDAR_2026.sort((a, b) => a.date.localeCompare(b.date));
}

export function getEventsWithin2Hours(): EconomicEvent[] {
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  return CALENDAR_2026.filter((e) => {
    if (!e.time) return false;
    const eventDate = new Date(`${e.date}T${e.time}:00`);
    return eventDate >= now && eventDate <= twoHoursLater;
  });
}
