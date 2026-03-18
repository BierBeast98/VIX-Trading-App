import useSWR from "swr";
import { getRefreshInterval } from "@/lib/trading-hours";

export function useAlertCount() {
  const { data } = useSWR<{ unacknowledgedCount: number }>(
    "/api/alerts?limit=0",
    { refreshInterval: getRefreshInterval() }
  );
  return data?.unacknowledgedCount ?? 0;
}
