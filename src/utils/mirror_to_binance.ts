import BigNumber from 'bignumber.js';
import { ITokenClassKey } from '../types/types.js';
import { IRawSwap } from '../dependencies/galaswap/types.js';
import { IBinanceApi } from '../dependencies/binance/binance_api.js';
import { BinanceTrading } from '../dependencies/binance/binance_trading.js';
import { IBinanceTokenMappingConfig, getBinanceSymbol } from '../dependencies/binance/token_mapping.js';
import { ILogger } from '../types/types.js';
import { ITokenBalance } from '../dependencies/galaswap/types.js';

/**
 * Mirrors a GalaSwap trade to Binance (REVERSE MIRRORING)
 * When a swap is created/accepted on GalaSwap, execute the OPPOSITE trade on Binance
 * This maintains position balance across exchanges:
 * - Selling GALA on GalaSwap → BUY GALA on Binance
 * - Buying GALA on GalaSwap → SELL GALA on Binance
 */
export async function mirrorSwapToBinance(
  swap: Pick<IRawSwap, 'offered' | 'wanted' | 'uses'>,
  binanceTrading: BinanceTrading | null,
  binanceApi: IBinanceApi | null,
  mappingConfig: IBinanceTokenMappingConfig,
  logger: ILogger,
  enabled: boolean = true,
): Promise<void> {
  if (!enabled) {
    return; // Mirroring disabled
  }

  if (!binanceTrading || !binanceApi) {
    return; // Binance not available, skip mirroring
  }

  if (!mappingConfig.enabled) {
    return; // Mapping disabled, skip mirroring
  }

  try {
    const offeredToken = swap.offered[0]?.tokenInstance;
    const wantedToken = swap.wanted[0]?.tokenInstance;
    const offeredQuantity = BigNumber(swap.offered[0]?.quantity || '0').multipliedBy(swap.uses);
    const wantedQuantity = BigNumber(swap.wanted[0]?.quantity || '0').multipliedBy(swap.uses);

    if (!offeredToken || !wantedToken) {
      return;
    }

    // Handle GUSDC/GUSDT -> USDT mapping
    // GUSDC and GUSDT on GalaSwap map to USDT on Binance
    // GWETH on GalaSwap maps to ETH on Binance
    const isOfferedStablecoin = offeredToken.collection === 'GUSDC' || offeredToken.collection === 'GUSDT';
    const isWantedStablecoin = wantedToken.collection === 'GUSDC' || wantedToken.collection === 'GUSDT';
    const isOfferedGWETH = offeredToken.collection === 'GWETH';
    const isWantedGWETH = wantedToken.collection === 'GWETH';
    
    // Map Gala tokens to Binance symbols
    let offeredSymbol = getBinanceSymbol(offeredToken, mappingConfig);
    let wantedSymbol = getBinanceSymbol(wantedToken, mappingConfig);
    
    // Handle GWETH -> ETH mapping
    if (isOfferedGWETH && !offeredSymbol) {
      // GWETH -> ETH on Binance (extract base from ETHUSDT)
      offeredSymbol = 'ETHUSDT'; // Will extract 'ETH' as base
    }
    if (isWantedGWETH && !wantedSymbol) {
      wantedSymbol = 'ETHUSDT'; // Will extract 'ETH' as base
    }
    
    // If stablecoin, we need to find the base asset symbol
    if (isOfferedStablecoin && !offeredSymbol) {
      // GUSDC/GUSDT -> treat as USDT equivalent
      offeredSymbol = 'USDT';
    }
    if (isWantedStablecoin && !wantedSymbol) {
      wantedSymbol = 'USDT';
    }

    // Extract base assets from Binance symbols (e.g., "GALAUSDT" -> "GALA", "ETHUSDT" -> "ETH")
    const getBaseAsset = (symbol: string | null): string | null => {
      if (!symbol || symbol === 'USDT') return null;
      // Remove quote currencies to get base asset
      return symbol.replace(/USDT|BTC|ETH|BNB$/, '') || null;
    };
    
    const offeredBase = getBaseAsset(offeredSymbol);
    const wantedBase = getBaseAsset(wantedSymbol);
    
    // Check if we can trade GALA/ETH pair directly on Binance
    const canTradeGalaEth = (offeredBase === 'GALA' && wantedBase === 'ETH') || 
                           (offeredBase === 'ETH' && wantedBase === 'GALA');
    
    // Only mirror if we can map to a tradeable pair
    const quoteCurrency = mappingConfig.defaultQuoteCurrency || 'USDT';
    
    // REVERSE MIRRORING LOGIC:
    // Case 1: Giving stablecoin (GUSDC/GUSDT), receiving base (GALA/GWETH) on GalaSwap
    //         → REVERSE: SELL base on Binance (we're buying on GalaSwap, so sell on Binance)
    // Case 2: Giving base (GALA/GWETH), receiving stablecoin (GUSDC/GUSDT) on GalaSwap
    //         → REVERSE: BUY base on Binance (we're selling on GalaSwap, so buy on Binance)
    // Case 3: GALA/GWETH pair → Try to trade GALA/ETH on Binance (if pair exists)
    
    // Handle GALA/GWETH → GALA/ETH trades (SAME DIRECTION, not reverse)
    // When trading GALA/GWETH on GalaSwap, execute same trade on Binance as GALA/ETH
    if (canTradeGalaEth && offeredBase && wantedBase) {
      const isGivingGALA = offeredBase === 'GALA';
      const galaAmount = isGivingGALA ? offeredQuantity.toNumber() : wantedQuantity.toNumber();
      const ethAmount = isGivingGALA ? wantedQuantity.toNumber() : offeredQuantity.toNumber();
      
      // Try GALAETH pair first
      try {
        const galaEthPrice = await binanceApi.getPrice('GALAETH');
        if (galaEthPrice) {
          // GALAETH pair exists - execute same-direction trade
          if (isGivingGALA) {
            // GalaSwap: Giving GALA, receiving GWETH
            // Binance: SAME = SELL GALA for ETH (using GALAETH pair)
            const tradeValue = galaAmount * Number(galaEthPrice.price);
            
            if (tradeValue >= 10) { // Minimum trade value
              logger.info(
                {
                  galaSwap: `Giving GALA, receiving GWETH`,
                  binanceAction: 'SELL GALA for ETH (same direction)',
                  symbol: 'GALAETH',
                  galaAmount,
                  ethAmount,
                  value: tradeValue,
                },
                'Mirroring GALA/GWETH trade to Binance GALA/ETH: SELL',
              );
              
              await binanceTrading.executeTrade({
                symbol: 'GALAETH',
                side: 'SELL',
                type: 'MARKET',
                quantity: String(galaAmount), // Amount in GALA
              });
              return; // Trade executed, exit
            }
          } else {
            // GalaSwap: Giving GWETH, receiving GALA
            // Binance: SAME = BUY GALA with ETH (using GALAETH pair)
            // For GALAETH pair: market BUY uses quoteOrderQty (amount in ETH, the quote currency)
            const ethPrice = await binanceApi.getPrice('ETHUSDT');
            if (ethPrice) {
              const tradeValue = ethAmount * Number(ethPrice.price); // Value in USDT
              
              if (tradeValue >= 10) { // Minimum trade value
                logger.info(
                  {
                    galaSwap: `Giving GWETH, receiving GALA`,
                    binanceAction: 'BUY GALA with ETH (same direction)',
                    symbol: 'GALAETH',
                    galaAmount,
                    ethAmount,
                    value: tradeValue,
                  },
                  'Mirroring GALA/GWETH trade to Binance GALA/ETH: BUY',
                );
                
                // For GALAETH pair, market BUY uses quoteOrderQty (amount in ETH)
                // executeTrade will handle this correctly for market BUY orders
                await binanceTrading.executeTrade({
                  symbol: 'GALAETH',
                  side: 'BUY',
                  type: 'MARKET',
                  quantity: String(ethAmount), // Amount in ETH (quote currency) - executeTrade converts to quoteOrderQty
                });
                return; // Trade executed, exit
              }
            }
          }
        }
      } catch (error) {
        // GALAETH pair doesn't exist or error - log and continue to other logic
        logger.debug(
          { 
            error,
            galaSwap: `Giving ${offeredToken.collection}, receiving ${wantedToken.collection}`,
          },
          'GALAETH pair not available or error, skipping direct pair trade',
        );
      }
      
      // If GALAETH pair doesn't work, skip (would require complex two-step trading)
      logger.debug(
        {
          galaSwap: `Giving ${offeredToken.collection}, receiving ${wantedToken.collection}`,
          binancePair: 'GALA/ETH',
          note: 'GALAETH pair not available or trade too small',
        },
        'Skipping GALA/GWETH mirror - GALAETH pair unavailable or below minimum',
      );
    } else if (isOfferedStablecoin && wantedSymbol && wantedSymbol !== 'USDT') {
      // GalaSwap: Giving stablecoin, receiving base = BUYING base on GalaSwap
      // Binance: REVERSE = SELL base on Binance
      const baseSymbol = wantedSymbol;
      const baseAmount = wantedQuantity.toNumber();
      
      // Get current price to check if trade value meets minimum
      const price = await binanceApi.getPrice(baseSymbol);
      if (price) {
        const tradeValue = baseAmount * Number(price.price);
        
        if (tradeValue >= 10) { // Minimum trade value in USDT
          logger.info(
            {
              galaSwap: `Giving ${offeredToken.collection}, receiving ${wantedToken.collection} (BUYING ${wantedToken.collection})`,
              binanceAction: 'SELL (reverse mirror)',
              symbol: baseSymbol,
              amount: baseAmount,
              value: tradeValue,
            },
            'Reverse mirroring GalaSwap trade to Binance: SELL',
          );
          
          await binanceTrading.executeTrade({
            symbol: baseSymbol,
            side: 'SELL',
            type: 'MARKET',
            quantity: String(baseAmount), // Amount in base currency for market sell
          });
        }
      }
    } else if (!isOfferedStablecoin && isWantedStablecoin && offeredSymbol && offeredSymbol !== 'USDT') {
      // GalaSwap: Giving base, receiving stablecoin = SELLING base on GalaSwap
      // Binance: REVERSE = BUY base on Binance
      const baseSymbol = offeredSymbol;
      const tradeAmount = wantedQuantity.toNumber(); // Amount in USDT (stablecoin received)
      
      if (tradeAmount >= 10) { // Minimum trade amount
        logger.info(
          {
            galaSwap: `Giving ${offeredToken.collection}, receiving ${wantedToken.collection} (SELLING ${offeredToken.collection})`,
            binanceAction: 'BUY (reverse mirror)',
            symbol: baseSymbol,
            amount: tradeAmount,
          },
          'Reverse mirroring GalaSwap trade to Binance: BUY',
        );
        
        await binanceTrading.executeTrade({
          symbol: baseSymbol,
          side: 'BUY',
          type: 'MARKET',
          quantity: String(tradeAmount), // Amount in quote currency for market buy
        });
      }
    } else {
      logger.debug(
        {
          offeredToken: offeredToken.collection,
          wantedToken: wantedToken.collection,
          offeredSymbol,
          wantedSymbol,
          isOfferedStablecoin,
          isWantedStablecoin,
        },
        'Skipping Binance mirror: cannot determine trade direction or tokens not tradeable',
      );
    }
  } catch (error) {
    logger.warn(
      {
        error,
        swap,
      },
      'Failed to mirror GalaSwap trade to Binance (non-fatal)',
    );
    // Don't throw - mirroring failures shouldn't break the main flow
  }
}

/**
 * Rebalances balances between GalaSwap and Binance
 * Maintains target balance ratios by trading on Binance when GalaSwap trades create imbalances
 */
export async function rebalanceWithBinance(
  galaBalances: readonly Readonly<ITokenBalance>[],
  binanceTrading: BinanceTrading | null,
  binanceApi: IBinanceApi | null,
  mappingConfig: IBinanceTokenMappingConfig,
  logger: ILogger,
  targetRatios: Record<string, number> = {}, // e.g., { "GALA": 0.5, "USDT": 0.3 }
  enabled: boolean = true,
  rebalanceThreshold: number = 0.1, // Rebalance if difference > 10%
): Promise<void> {
  if (!enabled) {
    return; // Rebalancing disabled
  }

  if (!binanceTrading || !binanceApi) {
    return; // Binance not available
  }

  if (!mappingConfig.enabled) {
    return; // Mapping disabled
  }

  try {
    // Get Binance balances
    const binanceBalances = new Map<string, BigNumber>();
    for (const mapping of mappingConfig.mappings) {
      const symbol = mapping.binanceSymbol;
      const baseAsset = symbol.replace(/USDT|BTC|ETH|BNB$/, '');
      const balance = await binanceTrading.getAvailableBalance(baseAsset);
      binanceBalances.set(baseAsset, balance);
    }
    
    // Get USDT balance from Binance
    const usdtBalance = await binanceTrading.getAvailableBalance('USDT');
    binanceBalances.set('USDT', usdtBalance);

    // Calculate total portfolio value and current ratios
    let totalValue = BigNumber(0);
    const tokenValues = new Map<string, BigNumber>();
    
    // For each token, calculate its value
    for (const galaBalance of galaBalances) {
      const token = galaBalance.collection;
      const symbol = getBinanceSymbol(galaBalance, mappingConfig);
      
      if (symbol && symbol !== 'USDT') {
        const baseAsset = symbol.replace(/USDT|BTC|ETH|BNB$/, '');
        const binanceBalance = binanceBalances.get(baseAsset) || BigNumber(0);
        const galaQty = BigNumber(galaBalance.quantity);
        
        // Get price to calculate value
        const price = await binanceApi.getPrice(symbol);
        if (price) {
          const galaValue = galaQty.multipliedBy(price.price);
          const binanceValue = binanceBalance.multipliedBy(price.price);
          const totalTokenValue = galaValue.plus(binanceValue);
          
          totalValue = totalValue.plus(totalTokenValue);
          tokenValues.set(token, totalTokenValue);
        }
      } else if (token === 'GUSDC' || token === 'GUSDT') {
        // Handle stablecoins - they're worth 1:1 with USDT
        const galaQty = BigNumber(galaBalance.quantity);
        const binanceUsdt = binanceBalances.get('USDT') || BigNumber(0);
        const totalStablecoinValue = galaQty.plus(binanceUsdt);
        totalValue = totalValue.plus(totalStablecoinValue);
        tokenValues.set('USDT', totalStablecoinValue);
      }
    }

    // Calculate current ratios
    const currentRatios: Record<string, number> = {};
    if (totalValue.isGreaterThan(0)) {
      for (const [token, value] of tokenValues.entries()) {
        currentRatios[token] = value.dividedBy(totalValue).toNumber();
      }
    }

    // Check if rebalancing is needed based on target ratios
    if (Object.keys(targetRatios).length > 0) {
      for (const [token, targetRatio] of Object.entries(targetRatios)) {
        const currentRatio = currentRatios[token] || 0;
        const difference = Math.abs(currentRatio - targetRatio);
        
        if (difference > rebalanceThreshold) {
          logger.info(
            {
              token,
              currentRatio,
              targetRatio,
              difference,
              threshold: rebalanceThreshold,
            },
            'Rebalancing needed: ratio difference exceeds threshold',
          );
          
          // Calculate rebalancing trade
          const targetValue = totalValue.multipliedBy(targetRatio);
          const currentValue = BigNumber(tokenValues.get(token) || 0);
          const rebalanceAmount = targetValue.minus(currentValue);
          
          if (rebalanceAmount.abs().isGreaterThan(10)) { // Minimum $10 rebalance
            // Determine if we need to buy or sell
            // Find the token balance to get the proper token class
            const galaBalance = galaBalances.find((b) => b.collection === token);
            
            if (rebalanceAmount.isPositive()) {
              // Need more of this token - buy on Binance
              if (token === 'USDT' || token === 'GUSDC' || token === 'GUSDT') {
                // For stablecoins, we can't buy USDT directly - skip
                logger.debug({ token }, 'Skipping rebalance: cannot buy stablecoin directly');
              } else if (galaBalance) {
                const symbol = getBinanceSymbol(galaBalance, mappingConfig);
                
                if (symbol && symbol !== 'USDT') {
                  const buyAmount = rebalanceAmount.abs().toNumber();
                  logger.info(
                    {
                      token,
                      symbol,
                      amount: buyAmount,
                      action: 'BUY',
                    },
                    'Executing rebalancing trade: BUY',
                  );
                  
                  await binanceTrading.executeTrade({
                    symbol,
                    side: 'BUY',
                    type: 'MARKET',
                    quantity: String(buyAmount), // Amount in USDT
                  });
                }
              }
            } else {
              // Need less of this token - sell on Binance
              if (token === 'USDT' || token === 'GUSDC' || token === 'GUSDT') {
                // For stablecoins, selling means converting to base asset
                // This is more complex - skip for now
                logger.debug({ token }, 'Skipping rebalance: stablecoin sell not implemented');
              } else if (galaBalance) {
                const symbol = getBinanceSymbol(galaBalance, mappingConfig);
                
                if (symbol && symbol !== 'USDT') {
                  const baseAsset = symbol.replace(/USDT|BTC|ETH|BNB$/, '');
                  const price = await binanceApi.getPrice(symbol);
                  
                  if (price) {
                    const sellAmount = rebalanceAmount.abs().dividedBy(price.price).toNumber();
                    
                    logger.info(
                      {
                        token,
                        symbol,
                        amount: sellAmount,
                        action: 'SELL',
                      },
                      'Executing rebalancing trade: SELL',
                    );
                    
                    await binanceTrading.executeTrade({
                      symbol,
                      side: 'SELL',
                      type: 'MARKET',
                      quantity: String(sellAmount), // Amount in base currency
                    });
                  }
                }
              }
            }
          }
        }
      }
    } else {
      logger.debug(
        {
          galaBalances: galaBalances.length,
          binanceBalances: binanceBalances.size,
          currentRatios,
        },
        'Rebalancing check completed (no target ratios configured)',
      );
    }
    
  } catch (error) {
    logger.warn(
      {
        error,
      },
      'Failed to rebalance with Binance (non-fatal)',
    );
    // Don't throw - rebalancing failures shouldn't break the main flow
  }
}

