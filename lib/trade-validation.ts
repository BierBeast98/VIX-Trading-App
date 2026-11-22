import { z } from "zod";

const date = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);
const optionalNumber = z.number().finite().optional().nullable();
const optionalPrice = z.number().finite().positive().optional().nullable();
const optionalExitPrice = z.number().finite().nonnegative().optional().nullable();

export const tradeFields = z.object({
  certificateId: z.string().trim().min(1),
  direction: z.enum(["long", "short"]),
  entryDate: date,
  exitDate: date.optional().nullable(),
  entryVix: z.number().finite().nonnegative().optional().nullable(),
  exitVix: z.number().finite().nonnegative().optional().nullable(),
  barrierLevel: z.number().finite().positive(),
  strikePrice: optionalPrice,
  leverageRatio: optionalNumber,
  ratio: optionalPrice,
  entryPrice: optionalPrice,
  exitPrice: optionalExitPrice,
  entryFees: optionalExitPrice,
  exitFees: optionalExitPrice,
  taxWithheld: optionalExitPrice,
  quantity: z.number().int().positive().optional().nullable(),
  returnPct: z.number().finite().min(-100).optional().nullable(),
  // Accepted for older clients; always derived from the dates on the server.
  holdDays: optionalNumber,
  alertTriggered: z.boolean(),
  notes: z.string(),
});

export const createTradeSchema = tradeFields.extend({
  direction: tradeFields.shape.direction.default("short"),
  positionId: z.string().min(1).optional(),
  alertTriggered: z.boolean().default(false),
  notes: z.string().default(""),
}).strict();
export const updateTradeSchema = tradeFields.partial().strict();

export function validateTradeClosingCosts(exitDate: Date | null, costs: { exitFees?: number | null; taxWithheld?: number | null }) {
  if (!exitDate && (costs.exitFees != null || costs.taxWithheld != null)) {
    throw new z.ZodError([{ code: "custom", path: ["exitDate"], message: "Verkaufsgebühren und Steuerabzug brauchen ein Ausstiegsdatum" }]);
  }
}

export function tradeDerivedValues(trade: {
  entryDate: Date; exitDate: Date | null;
  entryPrice?: number | null; exitPrice?: number | null; returnPct?: number | null;
}) {
  if (trade.exitDate && trade.exitDate.getTime() < trade.entryDate.getTime()) {
    throw new z.ZodError([{ code: "custom", path: ["exitDate"], message: "Ausstieg darf nicht vor dem Einstieg liegen" }]);
  }
  return {
    holdDays: trade.exitDate ? Math.round((trade.exitDate.getTime() - trade.entryDate.getTime()) / 86_400_000) : null,
    // A zero execution price is valid for a total loss.
    returnPct: !trade.exitDate ? null :
      trade.entryPrice != null && trade.entryPrice > 0 && trade.exitPrice != null
        ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100
        : trade.returnPct ?? null,
  };
}

export const positionFields = z.object({
  certificateId: z.string().trim().min(1),
  direction: z.enum(["long", "short"]),
  name: z.string(),
  entryVix: z.number().finite().nonnegative(),
  entryPrice: z.number().finite().positive(),
  barrierLevel: z.number().finite().positive(),
  currentBarrier: z.number().finite().positive(),
  leverageRatio: z.number().finite(),
  currentPrice: z.number().finite().nonnegative(),
  trailingStopFloor: optionalNumber,
  peakPnlPct: optionalNumber,
  notes: z.string(),
});
export const createPositionSchema = positionFields.omit({ trailingStopFloor: true, peakPnlPct: true }).extend({
  direction: z.enum(["long", "short"]).default("short"),
  name: z.string().default(""),
  currentPrice: z.number().finite().nonnegative().optional(),
  notes: z.string().default(""),
}).strict();
export const updatePositionSchema = positionFields.partial().strict();
export const closePositionSchema = z.object({
  exitDate: date,
  exitPrice: z.number().finite().nonnegative(),
  quantity: z.number().int().positive(),
  exitFees: optionalExitPrice,
  taxWithheld: optionalExitPrice,
}).strict();
