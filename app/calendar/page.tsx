"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, AlertTriangle, Info } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CorrelationChart } from "@/components/charts/CorrelationChart";
import { formatDate } from "@/lib/utils";

interface EconomicEvent {
  id: string;
  date: string;
  time?: string;
  title: string;
  type: string;
  impact: "high" | "medium" | "low";
  description?: string;
  country: string;
  historicalVixImpact?: number;
}

interface CorrelationPoint {
  date: string;
  vix: number;
  sp500Change: number;
}

const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const WEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const impactColors = {
  high: { bg: "#FF4D4D22", text: "#FF4D4D", border: "#FF4D4D44" },
  medium: { bg: "#F59E0B22", text: "#F59E0B", border: "#F59E0B44" },
  low: { bg: "#22C55E22", text: "#22C55E", border: "#22C55E44" },
};

const typeEmoji: Record<string, string> = {
  fed_meeting: "🏦",
  fed_speech: "🎤",
  cpi: "📊",
  nfp: "👔",
  consumer_confidence: "📈",
  gdp: "🏛",
  other: "📅",
};

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: events = [] } = useSWR<EconomicEvent[]>(
    `/api/calendar?type=month&year=${year}&month=${month}`
  );
  const { data: upcomingEvents = [] } = useSWR<EconomicEvent[]>(
    "/api/calendar?type=upcoming&days=30"
  );
  const { data: histData } = useSWR<{ vix: { date: string; close: number }[]; sp500: { date: string; close: number }[] }>(
    "/api/vix/historical?period=3m"
  );

  const loading = !events.length && !upcomingEvents.length && !histData;

  const correlationData = useMemo(() => {
    if (!histData?.vix || !histData?.sp500) return [];
    const vixMap = new Map(histData.vix.map((d) => [d.date, d.close]));
    const sp500Data = histData.sp500;
    const corr: CorrelationPoint[] = [];
    for (let i = 1; i < sp500Data.length; i++) {
      const d = sp500Data[i];
      const vix = vixMap.get(d.date);
      if (vix !== undefined && sp500Data[i - 1]) {
        const sp500Change = ((d.close - sp500Data[i - 1].close) / sp500Data[i - 1].close) * 100;
        corr.push({ date: d.date, vix, sp500Change });
      }
    }
    return corr.slice(-60);
  }, [histData]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Mon=0
  const totalDays = lastDay.getDate();

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDate = new Map<string, EconomicEvent[]>();
  for (const e of events) {
    if (!eventsByDate.has(e.date)) eventsByDate.set(e.date, []);
    eventsByDate.get(e.date)!.push(e);
  }

  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      <h1 className="text-2xl font-bold text-white">Wirtschaftskalender</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#B8E15A] border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2">
              <Card>
                {/* Month navigation */}
                <div className="flex items-center justify-between mb-6">
                  <button onClick={prevMonth} className="rounded-lg p-2 hover:bg-[#1E1E28] transition-colors" style={{ color: "#8B8FA8" }}>
                    <ChevronLeft size={18} />
                  </button>
                  <h2 className="text-base font-semibold text-white">
                    {MONTHS_DE[month - 1]} {year}
                  </h2>
                  <button onClick={nextMonth} className="rounded-lg p-2 hover:bg-[#1E1E28] transition-colors" style={{ color: "#8B8FA8" }}>
                    <ChevronRight size={18} />
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-2">
                  {WEEKDAYS_DE.map((d) => (
                    <div key={d} className="text-center text-xs font-medium py-1" style={{ color: "#8B8FA8" }}>{d}</div>
                  ))}
                </div>

                {/* Calendar cells */}
                <div className="grid grid-cols-7 gap-0.5">
                  {cells.map((day, i) => {
                    if (!day) return <div key={i} />;

                    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const dayEvents = eventsByDate.get(dateStr) ?? [];
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDate;
                    const hasHighImpact = dayEvents.some((e) => e.impact === "high");

                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                        className="flex flex-col items-center p-1.5 rounded-lg transition-all min-h-[52px]"
                        style={{
                          background: isSelected ? "#B8E15A22" : isToday ? "#1E1E28" : "transparent",
                          border: isSelected ? "1px solid #B8E15A" : isToday ? "1px solid #2E2E3A" : "1px solid transparent",
                        }}
                      >
                        <span
                          className="text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full"
                          style={{
                            color: isToday ? "#B8E15A" : "#FFFFFF",
                            background: isToday ? "#B8E15A22" : "transparent",
                          }}
                        >
                          {day}
                        </span>
                        {dayEvents.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                            {dayEvents.slice(0, 3).map((_, j) => (
                              <div
                                key={j}
                                className="w-1 h-1 rounded-full"
                                style={{
                                  background: hasHighImpact ? "#FF4D4D" : "#F59E0B",
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected day events */}
                {selectedDate && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: "#1E1E28" }}>
                    <div className="text-sm font-medium text-white mb-3">{formatDate(selectedDate)}</div>
                    {selectedEvents.length === 0 ? (
                      <p className="text-sm" style={{ color: "#8B8FA8" }}>Keine Events an diesem Tag</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-start gap-3 p-3 rounded-xl"
                            style={{
                              background: impactColors[ev.impact].bg,
                              border: `1px solid ${impactColors[ev.impact].border}`,
                            }}
                          >
                            <span className="text-lg">{typeEmoji[ev.type] ?? "📅"}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">{ev.title}</span>
                                {ev.time && <span className="text-xs" style={{ color: "#8B8FA8" }}>{ev.time} Uhr</span>}
                              </div>
                              {ev.description && (
                                <p className="text-xs mt-0.5" style={{ color: "#8B8FA8" }}>{ev.description}</p>
                              )}
                              {ev.historicalVixImpact && (
                                <p className="text-xs mt-1" style={{ color: impactColors[ev.impact].text }}>
                                  Ø VIX-Impact: +{ev.historicalVixImpact} Punkte
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* Upcoming Events */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-white">Nächste 30 Tage</CardTitle>
                </CardHeader>
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm py-2" style={{ color: "#8B8FA8" }}>Keine Events geplant</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {upcomingEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2.5 rounded-xl"
                        style={{ background: "#1A1A22", border: "1px solid #1E1E28" }}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-white line-clamp-1">{ev.title}</span>
                          <Badge variant={ev.impact === "high" ? "danger" : ev.impact === "medium" ? "warning" : "success"}>
                            {ev.impact === "high" ? "Hoch" : ev.impact === "medium" ? "Mittel" : "Niedrig"}
                          </Badge>
                        </div>
                        <div className="text-xs" style={{ color: "#8B8FA8" }}>
                          {formatDate(ev.date)}{ev.time ? ` · ${ev.time} Uhr` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Event Impact Legend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-white">Historische Ø VIX-Impacts</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {[
                    { type: "FOMC Meeting", impact: 2.5, emoji: "🏦" },
                    { type: "CPI Release", impact: 1.8, emoji: "📊" },
                    { type: "Non-Farm Payrolls", impact: 1.5, emoji: "👔" },
                    { type: "Fed Speech", impact: 0.8, emoji: "🎤" },
                  ].map((item) => (
                    <div key={item.type} className="flex items-center justify-between text-sm">
                      <span style={{ color: "#8B8FA8" }}>{item.emoji} {item.type}</span>
                      <span style={{ color: "#F59E0B" }}>+{item.impact} Pkt</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Correlation Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">
                S&P 500 / VIX Korrelation (90 Tage)
              </CardTitle>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "#8B8FA8" }}>
                <Info size={12} />
                VIX steigt bei fallenden S&P 500 Kursen
              </div>
            </CardHeader>
            {correlationData.length > 0 ? (
              <CorrelationChart data={correlationData} height={220} />
            ) : (
              <div className="flex justify-center py-8">
                <p className="text-sm" style={{ color: "#8B8FA8" }}>Keine Korrelationsdaten verfügbar</p>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
