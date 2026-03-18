export interface EconomicEvent {
  id: string;
  date: string;
  time?: string;
  title: string;
  type: "fed_meeting" | "fed_speech" | "cpi" | "nfp" | "consumer_confidence" | "gdp" | "other" | "central_bank" | "pmi";
  impact: "high" | "medium" | "low";
  description?: string;
  country: string;
  historicalVixImpact?: number;
}

// 2026 Economic Calendar — key events (times in CET/CEST)
const CALENDAR_2026: EconomicEvent[] = [

  // ── USA ─────────────────────────────────────────────────────────────────────

  // FOMC Meetings 2026
  { id: "fomc-2026-01", date: "2026-01-28", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-03", date: "2026-03-18", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-05", date: "2026-05-06", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-06", date: "2026-06-17", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-07", date: "2026-07-29", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-09", date: "2026-09-16", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-11", date: "2026-11-04", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },
  { id: "fomc-2026-12", date: "2026-12-16", time: "20:00", title: "FOMC Zinsentscheidung", type: "fed_meeting", impact: "high", country: "US", description: "Federal Open Market Committee Zinsentscheidung & Statement", historicalVixImpact: 2.5 },

  // US CPI 2026
  { id: "cpi-2026-01", date: "2026-01-15", time: "14:30", title: "US CPI (Dez)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index — Kernrate und Gesamt", historicalVixImpact: 1.8 },
  { id: "cpi-2026-02", date: "2026-02-12", time: "14:30", title: "US CPI (Jan)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-03", date: "2026-03-11", time: "14:30", title: "US CPI (Feb)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-04", date: "2026-04-10", time: "14:30", title: "US CPI (Mär)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-05", date: "2026-05-13", time: "14:30", title: "US CPI (Apr)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-06", date: "2026-06-10", time: "14:30", title: "US CPI (Mai)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-07", date: "2026-07-14", time: "14:30", title: "US CPI (Jun)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-08", date: "2026-08-12", time: "14:30", title: "US CPI (Jul)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-09", date: "2026-09-09", time: "14:30", title: "US CPI (Aug)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-10", date: "2026-10-14", time: "14:30", title: "US CPI (Sep)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-11", date: "2026-11-12", time: "14:30", title: "US CPI (Okt)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },
  { id: "cpi-2026-12", date: "2026-12-09", time: "14:30", title: "US CPI (Nov)", type: "cpi", impact: "high", country: "US", description: "Consumer Price Index", historicalVixImpact: 1.8 },

  // US NFP 2026
  { id: "nfp-2026-02", date: "2026-02-06", time: "14:30", title: "Non-Farm Payrolls (Jan)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-03", date: "2026-03-06", time: "14:30", title: "Non-Farm Payrolls (Feb)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-04", date: "2026-04-03", time: "14:30", title: "Non-Farm Payrolls (Mär)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-05", date: "2026-05-01", time: "14:30", title: "Non-Farm Payrolls (Apr)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-06", date: "2026-06-05", time: "14:30", title: "Non-Farm Payrolls (Mai)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-07", date: "2026-07-10", time: "14:30", title: "Non-Farm Payrolls (Jun)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-08", date: "2026-08-07", time: "14:30", title: "Non-Farm Payrolls (Jul)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-09", date: "2026-09-04", time: "14:30", title: "Non-Farm Payrolls (Aug)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-10", date: "2026-10-02", time: "14:30", title: "Non-Farm Payrolls (Sep)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-11", date: "2026-11-06", time: "14:30", title: "Non-Farm Payrolls (Okt)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },
  { id: "nfp-2026-12", date: "2026-12-04", time: "14:30", title: "Non-Farm Payrolls (Nov)", type: "nfp", impact: "high", country: "US", description: "US Arbeitsmarktbericht", historicalVixImpact: 1.5 },

  // ── EU / EZB ────────────────────────────────────────────────────────────────

  // EZB Zinsentscheide 2026 (Donnerstage, 14:15 CET)
  { id: "ecb-2026-01", date: "2026-01-30", time: "14:15", title: "EZB Zinsentscheidung", type: "central_bank", impact: "high", country: "EU", description: "EZB Leitzinsentscheid & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-03", date: "2026-03-06", time: "14:15", title: "EZB Zinsentscheidung", type: "central_bank", impact: "high", country: "EU", description: "EZB Leitzinsentscheid & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-04", date: "2026-04-17", time: "14:15", title: "EZB Zinsentscheidung", type: "central_bank", impact: "high", country: "EU", description: "EZB Leitzinsentscheid & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-06", date: "2026-06-05", time: "14:15", title: "EZB Zinsentscheidung", type: "central_bank", impact: "high", country: "EU", description: "EZB Leitzinsentscheid & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-07", date: "2026-07-24", time: "14:15", title: "EZB Zinsentscheidung", type: "central_bank", impact: "high", country: "EU", description: "EZB Leitzinsentscheid & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-09", date: "2026-09-11", time: "14:15", title: "EZB Zinsentscheidung", type: "central_bank", impact: "high", country: "EU", description: "EZB Leitzinsentscheid & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-10", date: "2026-10-23", time: "14:15", title: "EZB Zinsentscheidung", type: "central_bank", impact: "high", country: "EU", description: "EZB Leitzinsentscheid & Pressekonferenz", historicalVixImpact: 1.2 },
  { id: "ecb-2026-12", date: "2026-12-04", time: "14:15", title: "EZB Zinsentscheidung", type: "central_bank", impact: "high", country: "EU", description: "EZB Leitzinsentscheid & Pressekonferenz", historicalVixImpact: 1.2 },

  // Eurozone CPI Flash (Ende des Monats, 11:00 CET)
  { id: "ez-cpi-2026-03", date: "2026-03-31", time: "11:00", title: "EZ CPI Flash (Feb)", type: "cpi", impact: "medium", country: "EU", description: "Eurozone Verbraucherpreise — Erstschätzung", historicalVixImpact: 0.8 },
  { id: "ez-cpi-2026-04", date: "2026-04-30", time: "11:00", title: "EZ CPI Flash (Mär)", type: "cpi", impact: "medium", country: "EU", description: "Eurozone Verbraucherpreise — Erstschätzung", historicalVixImpact: 0.8 },
  { id: "ez-cpi-2026-05", date: "2026-05-29", time: "11:00", title: "EZ CPI Flash (Apr)", type: "cpi", impact: "medium", country: "EU", description: "Eurozone Verbraucherpreise — Erstschätzung", historicalVixImpact: 0.8 },
  { id: "ez-cpi-2026-06", date: "2026-06-30", time: "11:00", title: "EZ CPI Flash (Mai)", type: "cpi", impact: "medium", country: "EU", description: "Eurozone Verbraucherpreise — Erstschätzung", historicalVixImpact: 0.8 },
  { id: "ez-cpi-2026-07", date: "2026-07-31", time: "11:00", title: "EZ CPI Flash (Jun)", type: "cpi", impact: "medium", country: "EU", description: "Eurozone Verbraucherpreise — Erstschätzung", historicalVixImpact: 0.8 },
  { id: "ez-cpi-2026-08", date: "2026-08-31", time: "11:00", title: "EZ CPI Flash (Jul)", type: "cpi", impact: "medium", country: "EU", description: "Eurozone Verbraucherpreise — Erstschätzung", historicalVixImpact: 0.8 },
  { id: "ez-cpi-2026-09", date: "2026-09-30", time: "11:00", title: "EZ CPI Flash (Aug)", type: "cpi", impact: "medium", country: "EU", description: "Eurozone Verbraucherpreise — Erstschätzung", historicalVixImpact: 0.8 },
  { id: "ez-cpi-2026-10", date: "2026-10-30", time: "11:00", title: "EZ CPI Flash (Sep)", type: "cpi", impact: "medium", country: "EU", description: "Eurozone Verbraucherpreise — Erstschätzung", historicalVixImpact: 0.8 },

  // Eurozone Flash PMI (3. Woche des Monats, 10:00 CET)
  { id: "ez-pmi-2026-03", date: "2026-03-23", time: "10:00", title: "EZ Flash PMI (Mär)", type: "pmi", impact: "medium", country: "EU", description: "Einkaufsmanagerindex Industrie & Dienstleistungen — Erstschätzung", historicalVixImpact: 0.6 },
  { id: "ez-pmi-2026-04", date: "2026-04-22", time: "10:00", title: "EZ Flash PMI (Apr)", type: "pmi", impact: "medium", country: "EU", description: "Einkaufsmanagerindex Industrie & Dienstleistungen — Erstschätzung", historicalVixImpact: 0.6 },
  { id: "ez-pmi-2026-05", date: "2026-05-22", time: "10:00", title: "EZ Flash PMI (Mai)", type: "pmi", impact: "medium", country: "EU", description: "Einkaufsmanagerindex Industrie & Dienstleistungen — Erstschätzung", historicalVixImpact: 0.6 },
  { id: "ez-pmi-2026-06", date: "2026-06-22", time: "10:00", title: "EZ Flash PMI (Jun)", type: "pmi", impact: "medium", country: "EU", description: "Einkaufsmanagerindex Industrie & Dienstleistungen — Erstschätzung", historicalVixImpact: 0.6 },
  { id: "ez-pmi-2026-07", date: "2026-07-23", time: "10:00", title: "EZ Flash PMI (Jul)", type: "pmi", impact: "medium", country: "EU", description: "Einkaufsmanagerindex Industrie & Dienstleistungen — Erstschätzung", historicalVixImpact: 0.6 },
  { id: "ez-pmi-2026-09", date: "2026-09-22", time: "10:00", title: "EZ Flash PMI (Sep)", type: "pmi", impact: "medium", country: "EU", description: "Einkaufsmanagerindex Industrie & Dienstleistungen — Erstschätzung", historicalVixImpact: 0.6 },

  // Eurozone BIP Flash (Ende April / Ende Juli)
  { id: "ez-gdp-2026-q1", date: "2026-04-30", time: "11:00", title: "EZ BIP Q1 2026 (Flash)", type: "gdp", impact: "medium", country: "EU", description: "Eurozone Bruttoinlandsprodukt — Erstschätzung Q1 2026", historicalVixImpact: 0.7 },
  { id: "ez-gdp-2026-q2", date: "2026-07-30", time: "11:00", title: "EZ BIP Q2 2026 (Flash)", type: "gdp", impact: "medium", country: "EU", description: "Eurozone Bruttoinlandsprodukt — Erstschätzung Q2 2026", historicalVixImpact: 0.7 },

  // ── Deutschland ─────────────────────────────────────────────────────────────

  // Ifo Geschäftsklimaindex (4. Woche des Monats, 10:00 CET)
  { id: "de-ifo-2026-03", date: "2026-03-23", time: "10:00", title: "Ifo Geschäftsklima (Mär)", type: "consumer_confidence", impact: "medium", country: "DE", description: "Ifo Institut — Geschäftsklimaindex für die deutsche Wirtschaft", historicalVixImpact: 0.5 },
  { id: "de-ifo-2026-04", date: "2026-04-27", time: "10:00", title: "Ifo Geschäftsklima (Apr)", type: "consumer_confidence", impact: "medium", country: "DE", description: "Ifo Institut — Geschäftsklimaindex für die deutsche Wirtschaft", historicalVixImpact: 0.5 },
  { id: "de-ifo-2026-05", date: "2026-05-25", time: "10:00", title: "Ifo Geschäftsklima (Mai)", type: "consumer_confidence", impact: "medium", country: "DE", description: "Ifo Institut — Geschäftsklimaindex für die deutsche Wirtschaft", historicalVixImpact: 0.5 },
  { id: "de-ifo-2026-06", date: "2026-06-22", time: "10:00", title: "Ifo Geschäftsklima (Jun)", type: "consumer_confidence", impact: "medium", country: "DE", description: "Ifo Institut — Geschäftsklimaindex für die deutsche Wirtschaft", historicalVixImpact: 0.5 },
  { id: "de-ifo-2026-07", date: "2026-07-27", time: "10:00", title: "Ifo Geschäftsklima (Jul)", type: "consumer_confidence", impact: "medium", country: "DE", description: "Ifo Institut — Geschäftsklimaindex für die deutsche Wirtschaft", historicalVixImpact: 0.5 },
  { id: "de-ifo-2026-08", date: "2026-08-24", time: "10:00", title: "Ifo Geschäftsklima (Aug)", type: "consumer_confidence", impact: "medium", country: "DE", description: "Ifo Institut — Geschäftsklimaindex für die deutsche Wirtschaft", historicalVixImpact: 0.5 },
  { id: "de-ifo-2026-09", date: "2026-09-22", time: "10:00", title: "Ifo Geschäftsklima (Sep)", type: "consumer_confidence", impact: "medium", country: "DE", description: "Ifo Institut — Geschäftsklimaindex für die deutsche Wirtschaft", historicalVixImpact: 0.5 },

  // ZEW Konjunkturerwartungen (2. Dienstag, 11:00 CET)
  { id: "de-zew-2026-03", date: "2026-03-17", time: "11:00", title: "ZEW Konjunkturerwartungen (Mär)", type: "consumer_confidence", impact: "medium", country: "DE", description: "ZEW — Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.4 },
  { id: "de-zew-2026-04", date: "2026-04-14", time: "11:00", title: "ZEW Konjunkturerwartungen (Apr)", type: "consumer_confidence", impact: "medium", country: "DE", description: "ZEW — Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.4 },
  { id: "de-zew-2026-05", date: "2026-05-12", time: "11:00", title: "ZEW Konjunkturerwartungen (Mai)", type: "consumer_confidence", impact: "medium", country: "DE", description: "ZEW — Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.4 },
  { id: "de-zew-2026-06", date: "2026-06-09", time: "11:00", title: "ZEW Konjunkturerwartungen (Jun)", type: "consumer_confidence", impact: "medium", country: "DE", description: "ZEW — Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.4 },
  { id: "de-zew-2026-07", date: "2026-07-14", time: "11:00", title: "ZEW Konjunkturerwartungen (Jul)", type: "consumer_confidence", impact: "medium", country: "DE", description: "ZEW — Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.4 },
  { id: "de-zew-2026-09", date: "2026-09-08", time: "11:00", title: "ZEW Konjunkturerwartungen (Sep)", type: "consumer_confidence", impact: "medium", country: "DE", description: "ZEW — Konjunkturerwartungen für Deutschland", historicalVixImpact: 0.4 },

  // DE CPI Flash (letzte Woche des Monats, 08:00 CET — Destatis)
  { id: "de-cpi-2026-03", date: "2026-03-30", time: "08:00", title: "DE CPI Flash (Mär)", type: "cpi", impact: "medium", country: "DE", description: "Deutsche Verbraucherpreise — Destatis Erstschätzung", historicalVixImpact: 0.5 },
  { id: "de-cpi-2026-04", date: "2026-04-28", time: "08:00", title: "DE CPI Flash (Apr)", type: "cpi", impact: "medium", country: "DE", description: "Deutsche Verbraucherpreise — Destatis Erstschätzung", historicalVixImpact: 0.5 },
  { id: "de-cpi-2026-05", date: "2026-05-27", time: "08:00", title: "DE CPI Flash (Mai)", type: "cpi", impact: "medium", country: "DE", description: "Deutsche Verbraucherpreise — Destatis Erstschätzung", historicalVixImpact: 0.5 },
  { id: "de-cpi-2026-06", date: "2026-06-29", time: "08:00", title: "DE CPI Flash (Jun)", type: "cpi", impact: "medium", country: "DE", description: "Deutsche Verbraucherpreise — Destatis Erstschätzung", historicalVixImpact: 0.5 },
  { id: "de-cpi-2026-07", date: "2026-07-29", time: "08:00", title: "DE CPI Flash (Jul)", type: "cpi", impact: "medium", country: "DE", description: "Deutsche Verbraucherpreise — Destatis Erstschätzung", historicalVixImpact: 0.5 },
  { id: "de-cpi-2026-09", date: "2026-09-28", time: "08:00", title: "DE CPI Flash (Sep)", type: "cpi", impact: "medium", country: "DE", description: "Deutsche Verbraucherpreise — Destatis Erstschätzung", historicalVixImpact: 0.5 },

  // DE BIP Flash (Ende April / Ende Juli)
  { id: "de-gdp-2026-q1", date: "2026-04-30", time: "08:00", title: "DE BIP Q1 2026 (Flash)", type: "gdp", impact: "medium", country: "DE", description: "Deutsches Bruttoinlandsprodukt — Destatis Erstschätzung Q1", historicalVixImpact: 0.6 },
  { id: "de-gdp-2026-q2", date: "2026-07-30", time: "08:00", title: "DE BIP Q2 2026 (Flash)", type: "gdp", impact: "medium", country: "DE", description: "Deutsches Bruttoinlandsprodukt — Destatis Erstschätzung Q2", historicalVixImpact: 0.6 },

  // ── Großbritannien ──────────────────────────────────────────────────────────

  // Bank of England MPC Zinsentscheide 2026 (13:00 CET Winter / 14:00 CEST Sommer)
  { id: "boe-2026-02", date: "2026-02-05", time: "13:00", title: "BoE Zinsentscheidung", type: "central_bank", impact: "high", country: "GB", description: "Bank of England MPC Leitzinsentscheid", historicalVixImpact: 1.0 },
  { id: "boe-2026-03", date: "2026-03-19", time: "13:00", title: "BoE Zinsentscheidung", type: "central_bank", impact: "high", country: "GB", description: "Bank of England MPC Leitzinsentscheid", historicalVixImpact: 1.0 },
  { id: "boe-2026-05", date: "2026-05-07", time: "14:00", title: "BoE Zinsentscheidung", type: "central_bank", impact: "high", country: "GB", description: "Bank of England MPC Leitzinsentscheid", historicalVixImpact: 1.0 },
  { id: "boe-2026-06", date: "2026-06-18", time: "14:00", title: "BoE Zinsentscheidung", type: "central_bank", impact: "high", country: "GB", description: "Bank of England MPC Leitzinsentscheid", historicalVixImpact: 1.0 },
  { id: "boe-2026-08", date: "2026-08-06", time: "14:00", title: "BoE Zinsentscheidung", type: "central_bank", impact: "high", country: "GB", description: "Bank of England MPC Leitzinsentscheid", historicalVixImpact: 1.0 },
  { id: "boe-2026-09", date: "2026-09-17", time: "14:00", title: "BoE Zinsentscheidung", type: "central_bank", impact: "high", country: "GB", description: "Bank of England MPC Leitzinsentscheid", historicalVixImpact: 1.0 },
  { id: "boe-2026-11", date: "2026-11-05", time: "13:00", title: "BoE Zinsentscheidung", type: "central_bank", impact: "high", country: "GB", description: "Bank of England MPC Leitzinsentscheid", historicalVixImpact: 1.0 },
  { id: "boe-2026-12", date: "2026-12-17", time: "13:00", title: "BoE Zinsentscheidung", type: "central_bank", impact: "high", country: "GB", description: "Bank of England MPC Leitzinsentscheid", historicalVixImpact: 1.0 },

  // UK CPI (3. Mittwoch des Monats, 08:00 CET)
  { id: "uk-cpi-2026-03", date: "2026-03-25", time: "08:00", title: "UK CPI (Feb)", type: "cpi", impact: "medium", country: "GB", description: "Britische Verbraucherpreise — ONS", historicalVixImpact: 0.7 },
  { id: "uk-cpi-2026-04", date: "2026-04-15", time: "08:00", title: "UK CPI (Mär)", type: "cpi", impact: "medium", country: "GB", description: "Britische Verbraucherpreise — ONS", historicalVixImpact: 0.7 },
  { id: "uk-cpi-2026-05", date: "2026-05-20", time: "08:00", title: "UK CPI (Apr)", type: "cpi", impact: "medium", country: "GB", description: "Britische Verbraucherpreise — ONS", historicalVixImpact: 0.7 },
  { id: "uk-cpi-2026-06", date: "2026-06-17", time: "08:00", title: "UK CPI (Mai)", type: "cpi", impact: "medium", country: "GB", description: "Britische Verbraucherpreise — ONS", historicalVixImpact: 0.7 },
  { id: "uk-cpi-2026-07", date: "2026-07-15", time: "08:00", title: "UK CPI (Jun)", type: "cpi", impact: "medium", country: "GB", description: "Britische Verbraucherpreise — ONS", historicalVixImpact: 0.7 },
  { id: "uk-cpi-2026-08", date: "2026-08-19", time: "08:00", title: "UK CPI (Jul)", type: "cpi", impact: "medium", country: "GB", description: "Britische Verbraucherpreise — ONS", historicalVixImpact: 0.7 },
  { id: "uk-cpi-2026-09", date: "2026-09-16", time: "08:00", title: "UK CPI (Aug)", type: "cpi", impact: "medium", country: "GB", description: "Britische Verbraucherpreise — ONS", historicalVixImpact: 0.7 },

  // UK BIP
  { id: "uk-gdp-2026-q1", date: "2026-04-29", time: "08:00", title: "UK BIP Q1 2026 (Flash)", type: "gdp", impact: "medium", country: "GB", description: "Britisches Bruttoinlandsprodukt — ONS Erstschätzung Q1", historicalVixImpact: 0.6 },
  { id: "uk-gdp-2026-q2", date: "2026-07-29", time: "08:00", title: "UK BIP Q2 2026 (Flash)", type: "gdp", impact: "medium", country: "GB", description: "Britisches Bruttoinlandsprodukt — ONS Erstschätzung Q2", historicalVixImpact: 0.6 },

  // ── Japan ────────────────────────────────────────────────────────────────────

  // Bank of Japan Zinsentscheide 2026 (ca. 04:00 CET)
  { id: "boj-2026-01", date: "2026-01-24", time: "04:00", title: "BoJ Zinsentscheidung", type: "central_bank", impact: "high", country: "JP", description: "Bank of Japan — Leitzinsentscheid & Outlook", historicalVixImpact: 1.1 },
  { id: "boj-2026-03", date: "2026-03-19", time: "04:00", title: "BoJ Zinsentscheidung", type: "central_bank", impact: "high", country: "JP", description: "Bank of Japan — Leitzinsentscheid & Outlook", historicalVixImpact: 1.1 },
  { id: "boj-2026-04", date: "2026-04-30", time: "04:00", title: "BoJ Zinsentscheidung", type: "central_bank", impact: "high", country: "JP", description: "Bank of Japan — Leitzinsentscheid & Outlook", historicalVixImpact: 1.1 },
  { id: "boj-2026-06", date: "2026-06-19", time: "04:00", title: "BoJ Zinsentscheidung", type: "central_bank", impact: "high", country: "JP", description: "Bank of Japan — Leitzinsentscheid & Outlook", historicalVixImpact: 1.1 },
  { id: "boj-2026-07", date: "2026-07-31", time: "04:00", title: "BoJ Zinsentscheidung", type: "central_bank", impact: "high", country: "JP", description: "Bank of Japan — Leitzinsentscheid & Outlook", historicalVixImpact: 1.1 },
  { id: "boj-2026-09", date: "2026-09-18", time: "04:00", title: "BoJ Zinsentscheidung", type: "central_bank", impact: "high", country: "JP", description: "Bank of Japan — Leitzinsentscheid & Outlook", historicalVixImpact: 1.1 },
  { id: "boj-2026-10", date: "2026-10-29", time: "04:00", title: "BoJ Zinsentscheidung", type: "central_bank", impact: "high", country: "JP", description: "Bank of Japan — Leitzinsentscheid & Outlook", historicalVixImpact: 1.1 },
  { id: "boj-2026-12", date: "2026-12-18", time: "04:00", title: "BoJ Zinsentscheidung", type: "central_bank", impact: "high", country: "JP", description: "Bank of Japan — Leitzinsentscheid & Outlook", historicalVixImpact: 1.1 },

  // Japan CPI (ca. 00:30 CET, 3. Freitag nach Referenzmonat)
  { id: "jp-cpi-2026-03", date: "2026-03-20", time: "00:30", title: "Japan CPI (Feb)", type: "cpi", impact: "medium", country: "JP", description: "Japanische Verbraucherpreise — Statistics Bureau", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-04", date: "2026-04-24", time: "00:30", title: "Japan CPI (Mär)", type: "cpi", impact: "medium", country: "JP", description: "Japanische Verbraucherpreise — Statistics Bureau", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-05", date: "2026-05-22", time: "00:30", title: "Japan CPI (Apr)", type: "cpi", impact: "medium", country: "JP", description: "Japanische Verbraucherpreise — Statistics Bureau", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-06", date: "2026-06-19", time: "00:30", title: "Japan CPI (Mai)", type: "cpi", impact: "medium", country: "JP", description: "Japanische Verbraucherpreise — Statistics Bureau", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-07", date: "2026-07-24", time: "00:30", title: "Japan CPI (Jun)", type: "cpi", impact: "medium", country: "JP", description: "Japanische Verbraucherpreise — Statistics Bureau", historicalVixImpact: 0.4 },
  { id: "jp-cpi-2026-09", date: "2026-09-18", time: "00:30", title: "Japan CPI (Aug)", type: "cpi", impact: "medium", country: "JP", description: "Japanische Verbraucherpreise — Statistics Bureau", historicalVixImpact: 0.4 },

  // Tankan Survey (quartalsweise, Anfang April/Juli/Oktober/Januar)
  { id: "jp-tankan-2026-q1", date: "2026-04-01", time: "02:00", title: "Tankan Q1 2026", type: "consumer_confidence", impact: "medium", country: "JP", description: "BoJ Tankan — Unternehmenssentiment Großunternehmen Industrie", historicalVixImpact: 0.5 },
  { id: "jp-tankan-2026-q2", date: "2026-07-01", time: "02:00", title: "Tankan Q2 2026", type: "consumer_confidence", impact: "medium", country: "JP", description: "BoJ Tankan — Unternehmenssentiment Großunternehmen Industrie", historicalVixImpact: 0.5 },
  { id: "jp-tankan-2026-q3", date: "2026-10-01", time: "02:00", title: "Tankan Q3 2026", type: "consumer_confidence", impact: "medium", country: "JP", description: "BoJ Tankan — Unternehmenssentiment Großunternehmen Industrie", historicalVixImpact: 0.5 },

  // Japan BIP (quartalsweise)
  { id: "jp-gdp-2026-q4", date: "2026-03-09", time: "02:00", title: "Japan BIP Q4 2025", type: "gdp", impact: "medium", country: "JP", description: "Japanisches Bruttoinlandsprodukt — Cabinet Office", historicalVixImpact: 0.4 },
  { id: "jp-gdp-2026-q1", date: "2026-05-20", time: "02:00", title: "Japan BIP Q1 2026", type: "gdp", impact: "medium", country: "JP", description: "Japanisches Bruttoinlandsprodukt — Cabinet Office", historicalVixImpact: 0.4 },

  // ── Kanada ───────────────────────────────────────────────────────────────────

  // Bank of Canada Zinsentscheide 2026 (16:00 CET, 10:00 ET)
  { id: "boc-2026-01", date: "2026-01-29", time: "16:00", title: "BoC Zinsentscheidung", type: "central_bank", impact: "high", country: "CA", description: "Bank of Canada — Leitzinsentscheid", historicalVixImpact: 0.9 },
  { id: "boc-2026-03", date: "2026-03-04", time: "16:00", title: "BoC Zinsentscheidung", type: "central_bank", impact: "high", country: "CA", description: "Bank of Canada — Leitzinsentscheid", historicalVixImpact: 0.9 },
  { id: "boc-2026-04", date: "2026-04-15", time: "16:00", title: "BoC Zinsentscheidung", type: "central_bank", impact: "high", country: "CA", description: "Bank of Canada — Leitzinsentscheid", historicalVixImpact: 0.9 },
  { id: "boc-2026-06", date: "2026-06-03", time: "16:00", title: "BoC Zinsentscheidung", type: "central_bank", impact: "high", country: "CA", description: "Bank of Canada — Leitzinsentscheid", historicalVixImpact: 0.9 },
  { id: "boc-2026-07", date: "2026-07-29", time: "16:00", title: "BoC Zinsentscheidung", type: "central_bank", impact: "high", country: "CA", description: "Bank of Canada — Leitzinsentscheid", historicalVixImpact: 0.9 },
  { id: "boc-2026-09", date: "2026-09-09", time: "16:00", title: "BoC Zinsentscheidung", type: "central_bank", impact: "high", country: "CA", description: "Bank of Canada — Leitzinsentscheid", historicalVixImpact: 0.9 },
  { id: "boc-2026-10", date: "2026-10-28", time: "16:00", title: "BoC Zinsentscheidung", type: "central_bank", impact: "high", country: "CA", description: "Bank of Canada — Leitzinsentscheid", historicalVixImpact: 0.9 },
  { id: "boc-2026-12", date: "2026-12-09", time: "16:00", title: "BoC Zinsentscheidung", type: "central_bank", impact: "high", country: "CA", description: "Bank of Canada — Leitzinsentscheid", historicalVixImpact: 0.9 },

  // Kanada CPI (3. Woche des Monats, 14:30 CET)
  { id: "ca-cpi-2026-03", date: "2026-03-17", time: "14:30", title: "Kanada CPI (Jan)", type: "cpi", impact: "medium", country: "CA", description: "Kanadische Verbraucherpreise — Statistics Canada", historicalVixImpact: 0.5 },
  { id: "ca-cpi-2026-04", date: "2026-04-15", time: "14:30", title: "Kanada CPI (Feb)", type: "cpi", impact: "medium", country: "CA", description: "Kanadische Verbraucherpreise — Statistics Canada", historicalVixImpact: 0.5 },
  { id: "ca-cpi-2026-05", date: "2026-05-19", time: "14:30", title: "Kanada CPI (Mär)", type: "cpi", impact: "medium", country: "CA", description: "Kanadische Verbraucherpreise — Statistics Canada", historicalVixImpact: 0.5 },
  { id: "ca-cpi-2026-06", date: "2026-06-16", time: "14:30", title: "Kanada CPI (Apr)", type: "cpi", impact: "medium", country: "CA", description: "Kanadische Verbraucherpreise — Statistics Canada", historicalVixImpact: 0.5 },
  { id: "ca-cpi-2026-07", date: "2026-07-21", time: "14:30", title: "Kanada CPI (Mai)", type: "cpi", impact: "medium", country: "CA", description: "Kanadische Verbraucherpreise — Statistics Canada", historicalVixImpact: 0.5 },
  { id: "ca-cpi-2026-09", date: "2026-09-15", time: "14:30", title: "Kanada CPI (Jul)", type: "cpi", impact: "medium", country: "CA", description: "Kanadische Verbraucherpreise — Statistics Canada", historicalVixImpact: 0.5 },

  // Kanada BIP (quartalsweise)
  { id: "ca-gdp-2026-q1", date: "2026-05-29", time: "14:30", title: "Kanada BIP Q1 2026", type: "gdp", impact: "medium", country: "CA", description: "Kanadisches Bruttoinlandsprodukt — Statistics Canada", historicalVixImpact: 0.5 },
  { id: "ca-gdp-2026-q2", date: "2026-08-28", time: "14:30", title: "Kanada BIP Q2 2026", type: "gdp", impact: "medium", country: "CA", description: "Kanadisches Bruttoinlandsprodukt — Statistics Canada", historicalVixImpact: 0.5 },

  // ── China ────────────────────────────────────────────────────────────────────

  // PBoC LPR (Loan Prime Rate, ca. 20. des Monats, 02:15 CET)
  { id: "cn-lpr-2026-03", date: "2026-03-20", time: "02:15", title: "PBoC LPR (Mär)", type: "central_bank", impact: "medium", country: "CN", description: "People's Bank of China — Loan Prime Rate 1J & 5J", historicalVixImpact: 0.7 },
  { id: "cn-lpr-2026-04", date: "2026-04-20", time: "02:15", title: "PBoC LPR (Apr)", type: "central_bank", impact: "medium", country: "CN", description: "People's Bank of China — Loan Prime Rate 1J & 5J", historicalVixImpact: 0.7 },
  { id: "cn-lpr-2026-05", date: "2026-05-20", time: "02:15", title: "PBoC LPR (Mai)", type: "central_bank", impact: "medium", country: "CN", description: "People's Bank of China — Loan Prime Rate 1J & 5J", historicalVixImpact: 0.7 },
  { id: "cn-lpr-2026-06", date: "2026-06-20", time: "02:15", title: "PBoC LPR (Jun)", type: "central_bank", impact: "medium", country: "CN", description: "People's Bank of China — Loan Prime Rate 1J & 5J", historicalVixImpact: 0.7 },
  { id: "cn-lpr-2026-07", date: "2026-07-20", time: "02:15", title: "PBoC LPR (Jul)", type: "central_bank", impact: "medium", country: "CN", description: "People's Bank of China — Loan Prime Rate 1J & 5J", historicalVixImpact: 0.7 },
  { id: "cn-lpr-2026-08", date: "2026-08-20", time: "02:15", title: "PBoC LPR (Aug)", type: "central_bank", impact: "medium", country: "CN", description: "People's Bank of China — Loan Prime Rate 1J & 5J", historicalVixImpact: 0.7 },
  { id: "cn-lpr-2026-09", date: "2026-09-21", time: "02:15", title: "PBoC LPR (Sep)", type: "central_bank", impact: "medium", country: "CN", description: "People's Bank of China — Loan Prime Rate 1J & 5J", historicalVixImpact: 0.7 },
  { id: "cn-lpr-2026-10", date: "2026-10-20", time: "02:15", title: "PBoC LPR (Okt)", type: "central_bank", impact: "medium", country: "CN", description: "People's Bank of China — Loan Prime Rate 1J & 5J", historicalVixImpact: 0.7 },
  { id: "cn-lpr-2026-11", date: "2026-11-20", time: "02:15", title: "PBoC LPR (Nov)", type: "central_bank", impact: "medium", country: "CN", description: "People's Bank of China — Loan Prime Rate 1J & 5J", historicalVixImpact: 0.7 },
  { id: "cn-lpr-2026-12", date: "2026-12-21", time: "02:15", title: "PBoC LPR (Dez)", type: "central_bank", impact: "medium", country: "CN", description: "People's Bank of China — Loan Prime Rate 1J & 5J", historicalVixImpact: 0.7 },

  // China CPI (ca. 11. des Monats, 02:30 CET)
  { id: "cn-cpi-2026-03", date: "2026-03-10", time: "02:30", title: "China CPI (Feb)", type: "cpi", impact: "medium", country: "CN", description: "Chinesische Verbraucherpreise — NBS", historicalVixImpact: 0.6 },
  { id: "cn-cpi-2026-04", date: "2026-04-11", time: "02:30", title: "China CPI (Mär)", type: "cpi", impact: "medium", country: "CN", description: "Chinesische Verbraucherpreise — NBS", historicalVixImpact: 0.6 },
  { id: "cn-cpi-2026-05", date: "2026-05-12", time: "02:30", title: "China CPI (Apr)", type: "cpi", impact: "medium", country: "CN", description: "Chinesische Verbraucherpreise — NBS", historicalVixImpact: 0.6 },
  { id: "cn-cpi-2026-06", date: "2026-06-10", time: "02:30", title: "China CPI (Mai)", type: "cpi", impact: "medium", country: "CN", description: "Chinesische Verbraucherpreise — NBS", historicalVixImpact: 0.6 },
  { id: "cn-cpi-2026-07", date: "2026-07-10", time: "02:30", title: "China CPI (Jun)", type: "cpi", impact: "medium", country: "CN", description: "Chinesische Verbraucherpreise — NBS", historicalVixImpact: 0.6 },
  { id: "cn-cpi-2026-09", date: "2026-09-10", time: "02:30", title: "China CPI (Aug)", type: "cpi", impact: "medium", country: "CN", description: "Chinesische Verbraucherpreise — NBS", historicalVixImpact: 0.6 },

  // China BIP (quartalsweise, Mitte April/Juli/Oktober/Januar)
  { id: "cn-gdp-2026-q1", date: "2026-04-16", time: "02:30", title: "China BIP Q1 2026", type: "gdp", impact: "high", country: "CN", description: "Chinesisches Bruttoinlandsprodukt — NBS Quartalsbericht", historicalVixImpact: 0.9 },
  { id: "cn-gdp-2026-q2", date: "2026-07-15", time: "02:30", title: "China BIP Q2 2026", type: "gdp", impact: "high", country: "CN", description: "Chinesisches Bruttoinlandsprodukt — NBS Quartalsbericht", historicalVixImpact: 0.9 },
  { id: "cn-gdp-2026-q3", date: "2026-10-19", time: "02:30", title: "China BIP Q3 2026", type: "gdp", impact: "high", country: "CN", description: "Chinesisches Bruttoinlandsprodukt — NBS Quartalsbericht", historicalVixImpact: 0.9 },

  // Caixin PMI Manufacturing (erster Werktag des Monats, 03:45 CET)
  { id: "cn-pmi-2026-04", date: "2026-04-01", time: "03:45", title: "Caixin PMI Industrie (Mär)", type: "pmi", impact: "medium", country: "CN", description: "Caixin Manufacturing PMI — privater Sektor China", historicalVixImpact: 0.5 },
  { id: "cn-pmi-2026-05", date: "2026-05-04", time: "03:45", title: "Caixin PMI Industrie (Apr)", type: "pmi", impact: "medium", country: "CN", description: "Caixin Manufacturing PMI — privater Sektor China", historicalVixImpact: 0.5 },
  { id: "cn-pmi-2026-06", date: "2026-06-01", time: "03:45", title: "Caixin PMI Industrie (Mai)", type: "pmi", impact: "medium", country: "CN", description: "Caixin Manufacturing PMI — privater Sektor China", historicalVixImpact: 0.5 },
  { id: "cn-pmi-2026-07", date: "2026-07-01", time: "03:45", title: "Caixin PMI Industrie (Jun)", type: "pmi", impact: "medium", country: "CN", description: "Caixin Manufacturing PMI — privater Sektor China", historicalVixImpact: 0.5 },
  { id: "cn-pmi-2026-08", date: "2026-08-03", time: "03:45", title: "Caixin PMI Industrie (Jul)", type: "pmi", impact: "medium", country: "CN", description: "Caixin Manufacturing PMI — privater Sektor China", historicalVixImpact: 0.5 },
  { id: "cn-pmi-2026-09", date: "2026-09-01", time: "03:45", title: "Caixin PMI Industrie (Aug)", type: "pmi", impact: "medium", country: "CN", description: "Caixin Manufacturing PMI — privater Sektor China", historicalVixImpact: 0.5 },
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
