CREATE TABLE IF NOT EXISTS "MarketFetchDaily" (
  "day" DATE NOT NULL,
  "source" TEXT NOT NULL,
  "instrument" TEXT NOT NULL,
  "measurement" TEXT NOT NULL,
  "calls" BIGINT NOT NULL,
  "failed" BIGINT NOT NULL,
  "bytes" BIGINT NOT NULL,
  "durationMs" BIGINT NOT NULL,
  "returnedPoints" BIGINT NOT NULL,
  "insertedPoints" BIGINT NOT NULL,
  PRIMARY KEY ("day", "source", "instrument", "measurement")
);
CREATE INDEX IF NOT EXISTS "MarketObservation_instrument_kind_receivedAt_idx"
  ON "MarketObservation"("instrument", "kind", "receivedAt" DESC, "id" DESC);
