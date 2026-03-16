import useSWR from "swr";

export function useAlertCount() {
  const { data } = useSWR<{ unacknowledgedCount: number }>(
    "/api/alerts?limit=0",
    { refreshInterval: 60_000 }
  );
  return data?.unacknowledgedCount ?? 0;
}
