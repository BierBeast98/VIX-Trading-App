import { NextRequest, NextResponse } from "next/server";
import { getUpcomingEvents, getEventsForMonth, getAllEvents } from "@/lib/economic-calendar";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "upcoming";
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const days = parseInt(searchParams.get("days") || "30");

  if (type === "month") {
    return NextResponse.json(getEventsForMonth(year, month));
  }

  if (type === "all") {
    return NextResponse.json(getAllEvents());
  }

  return NextResponse.json(getUpcomingEvents(days));
}
