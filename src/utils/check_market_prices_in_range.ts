import { IGalaSwapToken } from '../dependencies/galaswap/types.js';
import { defaultTokenConfig } from '../token_config.js';
import { ILogger } from '../types/types.js';
import { areSameTokenClass, stringifyTokenClass } from '../types/type_helpers.js';

export function checkMarketPriceWithinRanges(
  tokenValues: readonly IGalaSwapToken[],
  config = defaultTokenConfig.priceLimits,
  logger?: ILogger,
) {
  // If no tokens are available (e.g., GalaSwap v1 is deprecated), skip price checks
  if (tokenValues.length === 0) {
    if (logger) {
      logger.warn({
        message: 'No token values available for price range checks. Skipping price validation.',
      });
    }
    return;
  }

  for (const token of config) {
    const matchingValue = tokenValues.find((tv) => areSameTokenClass(tv, token));
    if (typeof matchingValue?.currentPrices.usd !== 'number') {
      const errorMessage = `Could not find token value for ${stringifyTokenClass(token)}`;
      if (logger) {
        logger.warn({
          message: errorMessage,
          token: stringifyTokenClass(token),
          availableTokens: tokenValues.length,
        });
      } else {
        throw new Error(errorMessage);
      }
      continue; // Skip this token check instead of crashing
    }

    if (matchingValue.currentPrices.usd < token.min) {
      throw new Error(`Token ${stringifyTokenClass(token)} is below minimum specified price`);
    }

    if (matchingValue.currentPrices.usd > token.max) {
      throw new Error(`Token ${stringifyTokenClass(token)} is above maximum specified price`);
    }
  }
}
