-- Additive only: does not alter or remove any existing trading tables.
CREATE TABLE IF NOT EXISTS "MarketObservation" (
 "id" BIGSERIAL PRIMARY KEY, "key" TEXT NOT NULL, "fetchId" TEXT NOT NULL,
 "source" TEXT NOT NULL, "instrument" TEXT NOT NULL, "kind" TEXT NOT NULL,
 "currency" TEXT, "isin" TEXT, "contract" TEXT, "sourceAt" TIMESTAMP(3),
 "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "quality" TEXT NOT NULL,
 "last" DOUBLE PRECISION, "bid" DOUBLE PRECISION, "ask" DOUBLE PRECISION,
 "open" DOUBLE PRECISION, "high" DOUBLE PRECISION, "low" DOUBLE PRECISION,
 "close" DOUBLE PRECISION, "volume" DOUBLE PRECISION, "metadata" JSONB NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketObservation_key_key" ON "MarketObservation"("key");
CREATE INDEX IF NOT EXISTS "MarketObservation_instrument_sourceAt_idx" ON "MarketObservation"("instrument","sourceAt");
CREATE INDEX IF NOT EXISTS "MarketObservation_receivedAt_idx" ON "MarketObservation"("receivedAt");
CREATE INDEX IF NOT EXISTS "MarketObservation_fetchId_idx" ON "MarketObservation"("fetchId");
CREATE TABLE IF NOT EXISTS "MarketFetch" (
 "id" TEXT PRIMARY KEY, "runId" TEXT, "source" TEXT NOT NULL, "operation" TEXT NOT NULL,
 "instrument" TEXT NOT NULL, "origin" TEXT NOT NULL, "measurement" TEXT NOT NULL,
 "startedAt" TIMESTAMP(3) NOT NULL, "finishedAt" TIMESTAMP(3) NOT NULL,
 "durationMs" INTEGER NOT NULL, "success" BOOLEAN NOT NULL, "httpStatus" INTEGER,
 "responseBytes" INTEGER, "returnedPoints" INTEGER NOT NULL, "insertedPoints" INTEGER NOT NULL,
 "errorCode" TEXT
);
CREATE INDEX IF NOT EXISTS "MarketFetch_startedAt_idx" ON "MarketFetch"("startedAt");
CREATE INDEX IF NOT EXISTS "MarketFetch_source_startedAt_idx" ON "MarketFetch"("source","startedAt");
CREATE INDEX IF NOT EXISTS "MarketFetch_runId_idx" ON "MarketFetch"("runId");
CREATE TABLE IF NOT EXISTS "MarketCollectionRun" (
 "id" TEXT PRIMARY KEY, "slot" TEXT NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL,
 "finishedAt" TIMESTAMP(3), "leaseUntil" TIMESTAMP(3) NOT NULL,
 "status" TEXT NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 1, "errorCode" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketCollectionRun_slot_key" ON "MarketCollectionRun"("slot");
CREATE INDEX IF NOT EXISTS "MarketCollectionRun_startedAt_idx" ON "MarketCollectionRun"("startedAt");
