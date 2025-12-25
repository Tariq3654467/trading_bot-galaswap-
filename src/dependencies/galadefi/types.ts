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

// Quote request/response (V3 Protocol - GET with query params)
export const quoteRequestSchema = z
  .object({
    tokenIn: z.string(), // V3 format: "GALA|Unit|none|none" (pipe-separated, matching gSwap SDK)
    tokenOut: z.string(), // V3 format: "ETIME|Unit|none|none" (pipe-separated, matching gSwap SDK)
    amountIn: z.string().optional(),
    amountOut: z.string().optional(),
    fee: z.number().optional(), // Pool fee tier: 500 = 0.05%, 3000 = 0.3%, 10000 = 1%
  })
  .readonly();

export type IQuoteRequest = z.infer<typeof quoteRequestSchema>;

export const quoteResponseSchema = z
  .object({
    status: z.number(),
    message: z.string(),
    error: z.boolean(),
    data: z
      .object({
        currentSqrtPrice: z.string(),
        newSqrtPrice: z.string(),
        fee: z.number(),
        amountIn: z.string(),
        amountOut: z.string(),
      })
      .readonly(),
  })
  .readonly();

export type IQuoteResponse = z.infer<typeof quoteResponseSchema>;

// Swap request/response (V3 Protocol - two-step: generate payload, then bundle)
export const swapRequestSchema = z
  .object({
    tokenIn: tokenClassKeySchema,
    tokenOut: tokenClassKeySchema,
    amountIn: z.string(),
    amountOut: z.string(), // From quote
    fee: z.number(), // Pool fee tier
    sqrtPriceLimit: z.string(), // Price limit for slippage protection, use "0" for no limit
    amountInMaximum: z.string(), // Maximum input tokens
    amountOutMinimum: z.string(), // Minimum output tokens
  })
  .readonly();

export type ISwapRequest = z.infer<typeof swapRequestSchema>;

// Swap payload response (from /v1/trade/swap)
export const swapPayloadSchema = z
  .object({
    status: z.number(),
    message: z.string(),
    error: z.boolean(),
    data: z
      .object({
        token0: tokenClassKeySchema,
        token1: tokenClassKeySchema,
        fee: z.number(),
        amount: z.string(),
        zeroForOne: z.boolean(),
        sqrtPriceLimit: z.string(),
        amountInMaximum: z.string(),
        amountOutMinimum: z.string(),
        uniqueKey: z.string(),
      })
      .readonly(),
  })
  .readonly();

export type ISwapPayload = z.infer<typeof swapPayloadSchema>;

// Bundle response (from /v1/trade/bundle)
export const bundleResponseSchema = z
  .object({
    status: z.number(),
    message: z.string(),
    error: z.boolean(),
    data: z
      .object({
        data: z.string(), // Transaction ID
        message: z.string(),
        error: z.boolean(),
      })
      .readonly(),
  })
  .readonly();

export type IBundleResponse = z.infer<typeof bundleResponseSchema>;

// Combined swap response
export const swapResponseSchema = z
  .object({
    transactionId: z.string(),
    status: z.enum(['pending', 'completed', 'failed']),
    timestamp: z.number(),
  })
  .readonly();

export type ISwapResponse = z.infer<typeof swapResponseSchema>;

// Market prices (V3 Protocol)
export const singlePriceResponseSchema = z
  .object({
    price: z.string(),
    timestamp: z.string(),
  })
  .readonly();

export type ISinglePriceResponse = z.infer<typeof singlePriceResponseSchema>;

export const multiplePricesRequestSchema = z
  .object({
    tokens: z.array(z.string()).readonly(), // Array of V3 token format strings
  })
  .readonly();

export type IMultiplePricesRequest = z.infer<typeof multiplePricesRequestSchema>;

export const multiplePricesResponseSchema = z
  .object({
    status: z.number(),
    message: z.string(),
    error: z.boolean(),
    data: z.array(z.string()).readonly(), // Array of price strings
  })
  .readonly();

export type IMultiplePricesResponse = z.infer<typeof multiplePricesResponseSchema>;

// Liquidity operations (V3 Protocol)
export const addLiquidityRequestSchema = z
  .object({
    token0: tokenClassKeySchema,
    token1: tokenClassKeySchema,
    fee: z.number(), // Pool fee tier
    tickLower: z.number(),
    tickUpper: z.number(),
    amount0Desired: z.string(),
    amount1Desired: z.string(),
    amount0Min: z.string(),
    amount1Min: z.string(),
  })
  .readonly();

export type IAddLiquidityRequest = z.infer<typeof addLiquidityRequestSchema>;

export const removeLiquidityRequestSchema = z
  .object({
    token0: tokenClassKeySchema,
    token1: tokenClassKeySchema,
    fee: z.number(),
    tickLower: z.number(),
    tickUpper: z.number(),
    amount: z.string(), // Liquidity amount to remove
    amount0Min: z.string(),
    amount1Min: z.string(),
  })
  .readonly();

export type IRemoveLiquidityRequest = z.infer<typeof removeLiquidityRequestSchema>;

// Liquidity payload response (from /v1/trade/liquidity)
export const liquidityPayloadSchema = z
  .object({
    status: z.number(),
    message: z.string(),
    error: z.boolean(),
    data: z
      .object({
        token0: tokenClassKeySchema,
        token1: tokenClassKeySchema,
        fee: z.number(),
        tickLower: z.number(),
        tickUpper: z.number(),
        amount0Desired: z.string().optional(),
        amount1Desired: z.string().optional(),
        amount0Min: z.string(),
        amount1Min: z.string(),
        amount: z.string().optional(), // For remove liquidity
        uniqueKey: z.string(),
      })
      .readonly(),
  })
  .readonly();

export type ILiquidityPayload = z.infer<typeof liquidityPayloadSchema>;

// Combined liquidity response
export const liquidityResponseSchema = z
  .object({
    transactionId: z.string(),
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

// Positions (V3 Protocol)
export const positionSchema = z
  .object({
    fee: z.number(),
    liquidity: z.string(),
    poolHash: z.string(),
    positionId: z.string(),
    tickLower: z.number(),
    tickUpper: z.number(),
    token0ClassKey: tokenClassKeySchema,
    token1ClassKey: tokenClassKeySchema,
    token0Symbol: z.string().optional(),
    token1Symbol: z.string().optional(),
    token0Img: z.string().optional(),
    token1Img: z.string().optional(),
    tokensOwed0: z.string().optional(),
    tokensOwed1: z.string().optional(),
  })
  .readonly();

export type IPosition = z.infer<typeof positionSchema>;

export const positionsResponseSchema = z
  .object({
    status: z.number(),
    message: z.string(),
    error: z.boolean(),
    data: z
      .object({
        Status: z.number(),
        Data: z
          .object({
            nextBookMark: z.string().optional(),
            positions: z.array(positionSchema).readonly(),
          })
          .readonly(),
      })
      .readonly(),
  })
  .readonly();

export type IPositionsResponse = z.infer<typeof positionsResponseSchema>;

// Pool (V3 Protocol)
export const poolResponseSchema = z
  .object({
    status: z.number(),
    message: z.string(),
    error: z.boolean(),
    data: z
      .object({
        Status: z.number(),
        Data: z
          .object({
            fee: z.number(),
            feeGrowthGlobal0: z.string(),
            feeGrowthGlobal1: z.string(),
            grossPoolLiquidity: z.string(),
            liquidity: z.string(),
            maxLiquidityPerTick: z.string(),
            protocolFees: z.number(),
            protocolFeesToken0: z.string(),
            protocolFeesToken1: z.string(),
            sqrtPrice: z.string(),
            tickSpacing: z.number(),
            token0: z.string(),
            token0ClassKey: tokenClassKeySchema,
            token1: z.string(),
            token1ClassKey: tokenClassKeySchema,
          })
          .readonly(),
      })
      .readonly(),
  })
  .readonly();

export type IPoolResponse = z.infer<typeof poolResponseSchema>;

// Price Oracle types (V3 Protocol - POST with body)
export const priceOracleRequestSchema = z
  .object({
    token: z.string(), // V3 format: "GALA$Unit$none$none"
    page: z.number().optional(),
    limit: z.number().optional(),
    at: z.string().optional(), // ISO 8601 date string
    from: z.string().optional(), // ISO 8601 date string
    to: z.string().optional(), // ISO 8601 date string
    order: z.enum(['asc', 'desc']).optional(), // Sort order
  })
  .readonly();

export type IPriceOracleRequest = z.infer<typeof priceOracleRequestSchema>;

export const priceOraclePriceSchema = z
  .object({
    id: z.number(),
    compositeKey: z.string(), // V3 format: "GALA$Unit$none$none"
    price: z.string(),
    createdAt: z.string(), // ISO 8601 date string
    updatedAt: z.string(), // ISO 8601 date string
  })
  .readonly();

export type IPriceOraclePrice = z.infer<typeof priceOraclePriceSchema>;

export const priceOracleResponseSchema = z
  .object({
    status: z.number(),
    message: z.string(),
    error: z.boolean(),
    data: z
      .object({
        data: z.array(priceOraclePriceSchema).readonly(),
        meta: z
          .object({
            totalItems: z.number(),
            currentPage: z.number(),
            pageSize: z.number(),
            totalPages: z.number(),
          })
          .readonly()
          .optional(),
      })
      .readonly(),
  })
  .readonly();

export type IPriceOracleResponse = z.infer<typeof priceOracleResponseSchema>;

// Token format helper: converts ITokenClassKey to V3 format "Collection|Category|Type|AdditionalKey"
// Updated to match official gSwap SDK format (pipe-separated, not dollar-separated)
// Reference: https://galachain.github.io/gswap-sdk/docs/tutorial-basics/trading
export function formatTokenForV3(token: ITokenClassKey): string {
  return `${token.collection}|${token.category}|${token.type}|${token.additionalKey}`;
}

// Parse V3 format back to ITokenClassKey
// Supports both pipe (|) and dollar ($) separators for backward compatibility
export function parseTokenFromV3(tokenString: string): ITokenClassKey {
  // Try pipe separator first (SDK format), fall back to dollar separator (legacy)
  const separator = tokenString.includes('|') ? '|' : '$';
  const parts = tokenString.split(separator);
  if (parts.length !== 4) {
    throw new Error(`Invalid V3 token format: ${tokenString}. Expected format: Collection|Category|Type|AdditionalKey or Collection$Category$Type$AdditionalKey`);
  }
  // TypeScript doesn't narrow array access types, so we use non-null assertions
  // after validating length
  const [collection, category, type, additionalKey] = parts;
  if (collection === undefined || category === undefined || type === undefined || additionalKey === undefined) {
    throw new Error(`Invalid V3 token format: ${tokenString}. Expected format: Collection|Category|Type|AdditionalKey or Collection$Category$Type$AdditionalKey`);
  }
  return {
    collection,
    category,
    type,
    additionalKey,
  };
}

