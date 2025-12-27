import { z } from 'zod';

export const binancePriceSchema = z
  .object({
    symbol: z.string(),
    price: z.string(),
  })
  .readonly();

export type IBinancePrice = z.infer<typeof binancePriceSchema>;

export const binancePriceResponseSchema = z.array(binancePriceSchema).readonly();

export const binance24hrTickerSchema = z
  .object({
    symbol: z.string(),
    price: z.string(),
    priceChange: z.string().optional(),
    priceChangePercent: z.string().optional(),
    weightedAvgPrice: z.string().optional(),
    prevClosePrice: z.string().optional(),
    lastPrice: z.string().optional(),
    bidPrice: z.string().optional(),
    askPrice: z.string().optional(),
    openPrice: z.string().optional(),
    highPrice: z.string().optional(),
    lowPrice: z.string().optional(),
    volume: z.string().optional(),
    quoteVolume: z.string().optional(),
    openTime: z.number().optional(),
    closeTime: z.number().optional(),
    count: z.number().optional(),
  })
  .readonly();

export type IBinance24hrTicker = z.infer<typeof binance24hrTickerSchema>;

export const binance24hrTickerResponseSchema = z.array(binance24hrTickerSchema).readonly();

// Trading types
export type BinanceOrderSide = 'BUY' | 'SELL';
export type BinanceOrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'LIMIT_MAKER';
export type BinanceTimeInForce = 'GTC' | 'IOC' | 'FOK';
export type BinanceOrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'PENDING_CANCEL' | 'REJECTED' | 'EXPIRED';

export const binanceBalanceSchema = z
  .object({
    asset: z.string(),
    free: z.string(),
    locked: z.string(),
  })
  .readonly();

export type IBinanceBalance = z.infer<typeof binanceBalanceSchema>;

export const binanceAccountInfoSchema = z
  .object({
    balances: z.array(binanceBalanceSchema).readonly(),
    permissions: z.array(z.string()).readonly().optional(),
  })
  .readonly();

export type IBinanceAccountInfo = z.infer<typeof binanceAccountInfoSchema>;

export const binanceOrderSchema = z
  .object({
    symbol: z.string(),
    orderId: z.number(),
    orderListId: z.number().optional(),
    clientOrderId: z.string().optional(),
    price: z.string().optional(),
    origQty: z.string(),
    executedQty: z.string(),
    cummulativeQuoteQty: z.string().optional(),
    status: z.enum(['NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'PENDING_CANCEL', 'REJECTED', 'EXPIRED']),
    timeInForce: z.enum(['GTC', 'IOC', 'FOK']).optional(),
    type: z.enum(['MARKET', 'LIMIT', 'STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT', 'TAKE_PROFIT_LIMIT', 'LIMIT_MAKER']),
    side: z.enum(['BUY', 'SELL']),
    stopPrice: z.string().optional(),
    icebergQty: z.string().optional(),
    time: z.number(), // Normalized in placeOrder method if missing
    updateTime: z.number(), // Normalized in placeOrder method if missing
    isWorking: z.boolean().optional(),
    origQuoteOrderQty: z.string().optional(),
  })
  .readonly();

export type IBinanceOrder = z.infer<typeof binanceOrderSchema>;

export interface IBinanceNewOrderParams {
  symbol: string;
  side: BinanceOrderSide;
  type: BinanceOrderType;
  quantity?: string;
  quoteOrderQty?: string; // For market orders
  price?: string; // For limit orders
  timeInForce?: BinanceTimeInForce; // For limit orders
  stopPrice?: string; // For stop orders
  icebergQty?: string;
  newClientOrderId?: string;
  recvWindow?: number;
  timestamp: number;
}

