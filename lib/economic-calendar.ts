export interface EconomicEvent {
  id: string;
  date: string;
  time?: string;
  title: string;
  type: "fed_meeting" | "fed_speech" | "cpi" | "nfp" | "consumer_confidence" | "gdp" | "other";
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
