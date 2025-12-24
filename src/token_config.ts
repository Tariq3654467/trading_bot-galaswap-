import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { tokenClassKeySchema } from './types/types.js';

const tokenConfigSchema = z
  .object({
    priceLimits: z
      .array(
        z
          .object({
            collection: z.string(),
            category: z.string(),
            type: z.string(),
            additionalKey: z.string(),
            min: z.number(),
            max: z.number(),
          })
          .readonly(),
      )
      .readonly(),
    projectTokens: z
      .array(
        z
          .object({
            symbol: z.string(),
          })
          .readonly(),
      )
      .readonly(),
    binance: z
      .object({
        enabled: z.boolean().default(false),
        mappings: z
          .array(
            z
              .object({
                galaToken: tokenClassKeySchema,
                binanceSymbol: z.string(),
                quoteCurrency: z.string().optional(),
              })
              .readonly(),
          )
          .readonly()
          .default([]),
        defaultQuoteCurrency: z.string().default('USDT'),
        priceCombinationMethod: z
          .enum(['average', 'weighted_average', 'prefer_galaswap', 'prefer_binance'])
          .default('average'),
        galaswapWeight: z.number().min(0).max(1).default(0.5),
        binanceWeight: z.number().min(0).max(1).default(0.5),
        trading: z
          .object({
            enabled: z.boolean().default(false),
            minTradeAmount: z.number().default(10),
            maxTradeAmount: z.number().default(10000),
            defaultOrderType: z.enum(['MARKET', 'LIMIT']).default('MARKET'),
            tradingPairs: z
              .array(
                z
                  .object({
                    baseAsset: z.string(),
                    quoteAsset: z.string(),
                    symbol: z.string(),
                    minNotional: z.number().optional(),
                  })
                  .readonly(),
              )
              .readonly()
              .default([]),
          })
          .readonly()
          .optional(),
      })
      .readonly()
      .optional(),
  })
  .readonly();

export type ITokenConfig = z.infer<typeof tokenConfigSchema>;

const unparsedDefaultTokenConfig = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, '..', 'config', 'token_config.json'), 'utf-8'),
);

export const defaultTokenConfig = tokenConfigSchema.parse(unparsedDefaultTokenConfig);
