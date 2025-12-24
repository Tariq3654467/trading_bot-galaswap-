import { ITokenConfig } from '../token_config.js';
import { areSameTokenClass } from '../types/type_helpers.js';
import { ILogger, ITokenClassKey } from '../types/types.js';
import { IBinanceApi } from './binance/binance_api.js';
import { IBinanceTokenMappingConfig, getBinanceSymbol } from './binance/token_mapping.js';
import { IGalaSwapToken } from './galaswap/types.js';

export interface IEnhancedTokenPrice extends IGalaSwapToken {
  galaswapPrice?: number | undefined; // Original GalaSwap price
  binancePrice?: number | undefined; // Binance price
  priceSource?: 'galaswap' | 'binance' | 'both' | undefined;
  // When both prices are available, this is the combined/averaged price
}

/**
 * Aggregates prices from GalaSwap and Binance, enhancing token data with Binance prices
 */
export async function aggregatePrices(
  galaSwapTokens: readonly IGalaSwapToken[],
  binanceApi: IBinanceApi | null,
  binanceMappingConfig: IBinanceTokenMappingConfig,
  logger?: ILogger,
  tokenConfig?: ITokenConfig,
): Promise<readonly IEnhancedTokenPrice[]> {
  if (!binanceApi || !binanceMappingConfig.enabled) {
    return galaSwapTokens.map((token) => ({
      ...token,
      priceSource: 'galaswap' as const,
    }));
  }

  // Collect all Binance symbols we need to fetch
  const symbolToTokenMap = new Map<string, IGalaSwapToken[]>();
  const tokensNeedingBinancePrice: IGalaSwapToken[] = [];

  for (const token of galaSwapTokens) {
    const binanceSymbol = getBinanceSymbol(token, binanceMappingConfig);
    if (binanceSymbol) {
      if (!symbolToTokenMap.has(binanceSymbol)) {
        symbolToTokenMap.set(binanceSymbol, []);
      }
      symbolToTokenMap.get(binanceSymbol)!.push(token);
      tokensNeedingBinancePrice.push(token);
    }
  }

  if (symbolToTokenMap.size === 0) {
    return galaSwapTokens.map((token) => ({
      ...token,
      priceSource: 'galaswap' as const,
    }));
  }

  // Fetch prices from Binance
  const binanceSymbols = Array.from(symbolToTokenMap.keys());
  const binancePrices = await binanceApi.getPrices(binanceSymbols);

  logger?.info({
    message: 'Fetched Binance prices',
    symbols: binanceSymbols,
    pricesFound: binancePrices.size,
  });

  // Get price combination configuration
  const priceCombinationMethod =
    tokenConfig?.binance?.priceCombinationMethod ?? 'average';
  const galaswapWeight = tokenConfig?.binance?.galaswapWeight ?? 0.5;
  const binanceWeight = tokenConfig?.binance?.binanceWeight ?? 0.5;

  // Enhance tokens with Binance prices and combine both sources
  const enhancedTokens: IEnhancedTokenPrice[] = galaSwapTokens.map((token) => {
    const binanceSymbol = getBinanceSymbol(token, binanceMappingConfig);
    const binancePriceData = binanceSymbol ? binancePrices.get(binanceSymbol) : null;
    const binancePrice = binancePriceData ? parseFloat(binancePriceData.price) : undefined;
    const galaswapPrice = token.currentPrices.usd;

    let priceSource: 'galaswap' | 'binance' | 'both' = 'galaswap';
    let finalUsdPrice: number | undefined = galaswapPrice;

    // Combine both prices when available
    if (binancePrice && binancePrice > 0 && galaswapPrice && galaswapPrice > 0) {
      // Both prices available - combine based on configuration
      switch (priceCombinationMethod) {
        case 'average':
          // Simple average of both prices
          finalUsdPrice = (galaswapPrice + binancePrice) / 2;
          break;
        case 'weighted_average':
          // Weighted average using configured weights
          const totalWeight = galaswapWeight + binanceWeight;
          finalUsdPrice =
            (galaswapPrice * galaswapWeight + binancePrice * binanceWeight) / totalWeight;
          break;
        case 'prefer_galaswap':
          // Use GalaSwap price when both available
          finalUsdPrice = galaswapPrice;
          break;
        case 'prefer_binance':
          // Use Binance price when both available
          finalUsdPrice = binancePrice;
          break;
        default:
          // Default to average
          finalUsdPrice = (galaswapPrice + binancePrice) / 2;
      }
      priceSource = 'both';
    } else if (binancePrice && binancePrice > 0) {
      // Only Binance price available
      finalUsdPrice = binancePrice;
      priceSource = 'binance';
    } else if (galaswapPrice && galaswapPrice > 0) {
      // Only GalaSwap price available
      finalUsdPrice = galaswapPrice;
      priceSource = 'galaswap';
    }

    const enhancedToken: IEnhancedTokenPrice = {
      ...token,
      currentPrices: {
        ...token.currentPrices,
        usd: finalUsdPrice,
      },
    };
    
    if (galaswapPrice !== undefined) {
      enhancedToken.galaswapPrice = galaswapPrice;
    }
    if (binancePrice !== undefined) {
      enhancedToken.binancePrice = binancePrice;
    }
    if (priceSource !== undefined) {
      enhancedToken.priceSource = priceSource;
    }
    
    return enhancedToken;
  });

  return enhancedTokens;
}

/**
 * Gets Binance price for a specific token class
 */
export function getBinancePriceForToken(
  tokenClass: ITokenClassKey,
  enhancedTokens: readonly IEnhancedTokenPrice[],
): number | undefined {
  const token = enhancedTokens.find((t) => areSameTokenClass(t, tokenClass));
  return token?.binancePrice;
}

/**
 * Gets GalaSwap price for a specific token class
 */
export function getGalaSwapPriceForToken(
  tokenClass: ITokenClassKey,
  enhancedTokens: readonly IEnhancedTokenPrice[],
): number | undefined {
  const token = enhancedTokens.find((t) => areSameTokenClass(t, tokenClass));
  return token?.galaswapPrice;
}

/**
 * Gets both GalaSwap and Binance prices for a specific token class
 */
export function getBothPricesForToken(
  tokenClass: ITokenClassKey,
  enhancedTokens: readonly IEnhancedTokenPrice[],
): { galaswapPrice?: number | undefined; binancePrice?: number | undefined; combinedPrice?: number | undefined; priceSource?: string | undefined } {
  const token = enhancedTokens.find((t) => areSameTokenClass(t, tokenClass));
  if (!token) {
    return {};
  }

  const result: { galaswapPrice?: number | undefined; binancePrice?: number | undefined; combinedPrice?: number | undefined; priceSource?: string | undefined } = {};
  
  if (token.galaswapPrice !== undefined) {
    result.galaswapPrice = token.galaswapPrice;
  }
  if (token.binancePrice !== undefined) {
    result.binancePrice = token.binancePrice;
  }
  // IEnhancedTokenPrice extends IGalaSwapToken which has currentPrices
  const usdPrice = (token as IGalaSwapToken).currentPrices?.usd;
  if (usdPrice !== undefined) {
    result.combinedPrice = usdPrice;
  }
  if (token.priceSource !== undefined) {
    result.priceSource = token.priceSource;
  }

  return result;
}

