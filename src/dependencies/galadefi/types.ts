import { z } from 'zod';
import { ITokenClassKey, tokenClassKeySchema } from '../../types/types.js';

// Trading pair schema
export const tradingPairSchema = z
  .object({
    tokenA: tokenClassKeySchema,
    tokenB: tokenClassKeySchema,
    symbol: z.string(),
    liquidity: z.string().optional(),
    volume24h: z.string().optional(),
    price: z.string().optional(),
  })
  .readonly();

export type ITradingPair = z.infer<typeof tradingPairSchema>;

export const tradingPairsResponseSchema = z
  .object({
    pairs: z.array(tradingPairSchema).readonly(),
  })
  .readonly();

// Quote request/response
export const quoteRequestSchema = z
  .object({
    tokenIn: tokenClassKeySchema,
    tokenOut: tokenClassKeySchema,
    amountIn: z.string(),
    slippageTolerance: z.number().optional(),
  })
  .readonly();

export type IQuoteRequest = z.infer<typeof quoteRequestSchema>;

export const quoteResponseSchema = z
  .object({
    tokenIn: tokenClassKeySchema,
    tokenOut: tokenClassKeySchema,
    amountIn: z.string(),
    amountOut: z.string(),
    priceImpact: z.string().optional(),
    route: z.array(z.string()).optional(),
    estimatedGas: z.string().optional(),
  })
  .readonly();

export type IQuoteResponse = z.infer<typeof quoteResponseSchema>;

// Swap request/response
export const swapRequestSchema = z
  .object({
    tokenIn: tokenClassKeySchema,
    tokenOut: tokenClassKeySchema,
    amountIn: z.string(),
    amountOutMin: z.string().optional(),
    slippageTolerance: z.number().optional(),
    recipient: z.string().optional(),
    deadline: z.number().optional(),
  })
  .readonly();

export type ISwapRequest = z.infer<typeof swapRequestSchema>;

export const swapResponseSchema = z
  .object({
    transactionHash: z.string(),
    tokenIn: tokenClassKeySchema,
    tokenOut: tokenClassKeySchema,
    amountIn: z.string(),
    amountOut: z.string(),
    status: z.enum(['pending', 'completed', 'failed']),
    timestamp: z.number(),
  })
  .readonly();

export type ISwapResponse = z.infer<typeof swapResponseSchema>;

// Market prices
export const marketPriceSchema = z
  .object({
    token: tokenClassKeySchema,
    price: z.string(),
    priceUSD: z.number().optional(),
    change24h: z.string().optional(),
    volume24h: z.string().optional(),
  })
  .readonly();

export type IMarketPrice = z.infer<typeof marketPriceSchema>;

export const marketPricesResponseSchema = z
  .object({
    prices: z.array(marketPriceSchema).readonly(),
    timestamp: z.number(),
  })
  .readonly();

// Liquidity operations
export const addLiquidityRequestSchema = z
  .object({
    tokenA: tokenClassKeySchema,
    tokenB: tokenClassKeySchema,
    amountA: z.string(),
    amountB: z.string(),
    amountAMin: z.string().optional(),
    amountBMin: z.string().optional(),
    deadline: z.number().optional(),
  })
  .readonly();

export type IAddLiquidityRequest = z.infer<typeof addLiquidityRequestSchema>;

export const removeLiquidityRequestSchema = z
  .object({
    tokenA: tokenClassKeySchema,
    tokenB: tokenClassKeySchema,
    liquidity: z.string(),
    amountAMin: z.string().optional(),
    amountBMin: z.string().optional(),
    deadline: z.number().optional(),
  })
  .readonly();

export type IRemoveLiquidityRequest = z.infer<typeof removeLiquidityRequestSchema>;

export const liquidityResponseSchema = z
  .object({
    transactionHash: z.string(),
    tokenA: tokenClassKeySchema,
    tokenB: tokenClassKeySchema,
    amountA: z.string(),
    amountB: z.string(),
    liquidity: z.string(),
    status: z.enum(['pending', 'completed', 'failed']),
    timestamp: z.number(),
  })
  .readonly();

export type ILiquidityResponse = z.infer<typeof liquidityResponseSchema>;

// Balance response
export const balanceResponseSchema = z
  .object({
    balances: z
      .array(
        z
          .object({
            token: tokenClassKeySchema,
            balance: z.string(),
            available: z.string(),
            locked: z.string().optional(),
          })
          .readonly(),
      )
      .readonly(),
  })
  .readonly();

export type IBalanceResponse = z.infer<typeof balanceResponseSchema>;

