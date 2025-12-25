import { GSwap, PrivateKeySigner } from '@gala-chain/gswap-sdk';
import { ILogger, ITokenClassKey } from '../../types/types.js';

/**
 * GalaChain Router using Official gSwap SDK
 * Uses Token Class Keys (pipe-separated format: Collection|Category|Type|AdditionalKey)
 * Example: 'GALA|Unit|none|none'
 */
export interface IGalaChainSwapRequest {
  offered: readonly Readonly<{
    quantity: string;
    tokenInstance: Readonly<ITokenClassKey>;
  }>[];
  wanted: readonly Readonly<{
    quantity: string;
    tokenInstance: Readonly<ITokenClassKey>;
  }>[];
}

export interface IGalaChainSwapResult {
  transactionId: string;
  status: 'pending' | 'confirmed';
  blockNumber?: number;
}

export interface IGalaChainQuote {
  amountOut: string;
  priceImpact?: number | undefined;
  feeTier?: string | undefined;
}

/**
 * Convert Token Class Key to pipe-separated string format
 */
function formatTokenClassKey(token: Readonly<ITokenClassKey>): string {
  return `${token.collection}|${token.category}|${token.type}|${token.additionalKey}`;
}

export class GalaChainRouter {
  private readonly gSwap: GSwap;
  private readonly walletAddress: string;
  private readonly logger: ILogger;

  constructor(
    _rpcUrl: string, // Not used by SDK, but kept for compatibility
    walletAddress: string,
    privateKey: string,
    logger: ILogger,
    _contractName?: string, // Not used by SDK, but kept for compatibility
  ) {
    this.walletAddress = walletAddress;
    this.logger = logger;

    // Initialize gSwap SDK with private key signer
    this.gSwap = new GSwap({
      signer: new PrivateKeySigner(privateKey),
    });

    this.logger.info(
      {
        walletAddress: this.walletAddress,
      },
      'GalaChain router initialized with official gSwap SDK',
    );
  }

  /**
   * Execute swap using official gSwap SDK
   * This creates a direct swap (not an order book swap)
   */
  async requestSwap(swapRequest: IGalaChainSwapRequest): Promise<IGalaChainSwapResult> {
    try {
      const offeredFirst = swapRequest.offered[0];
      const wantedFirst = swapRequest.wanted[0];
      if (!offeredFirst || !wantedFirst) {
        throw new Error('Invalid swap request: missing offered or wanted token');
      }

      const tokenIn = formatTokenClassKey(offeredFirst.tokenInstance);
      const tokenOut = formatTokenClassKey(wantedFirst.tokenInstance);
      const amountIn = Number(offeredFirst.quantity);

      this.logger.info(
        {
          tokenIn,
          tokenOut,
          amountIn,
        },
        'Requesting swap via gSwap SDK',
      );

      // First, get a quote to find the best fee tier
      const quote = await this.gSwap.quoting.quoteExactInput(tokenIn, tokenOut, amountIn);

      this.logger.info(
        {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: quote.outTokenAmount.toString(),
          feeTier: quote.feeTier,
        },
        'Quote received from gSwap SDK',
      );

      // Execute swap with 5% slippage tolerance
      const slippageTolerance = 0.95; // 5% slippage
      const amountOutMinimum = quote.outTokenAmount.multipliedBy(slippageTolerance);

      const transaction = await this.gSwap.swaps.swap(
        tokenIn,
        tokenOut,
        quote.feeTier,
        {
          exactIn: amountIn,
          amountOutMinimum: amountOutMinimum,
        },
        this.walletAddress,
      );

      this.logger.info(
        {
          transactionId: transaction.transactionId ?? 'pending',
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: quote.outTokenAmount.toString(),
        },
        'Swap executed successfully via gSwap SDK',
      );

      return {
        transactionId: transaction.transactionId ?? 'pending',
        status: 'pending',
      };
    } catch (error) {
      this.logger.error({ error, swapRequest }, 'Failed to execute swap via gSwap SDK');
      throw error;
    }
  }

  /**
   * Accept an existing swap (order book style)
   * Note: gSwap SDK is primarily for direct swaps, not order book swaps
   * This method is kept for compatibility but may not work with SDK
   */
  async acceptSwap(_swapRequestId: string, _uses: string): Promise<IGalaChainSwapResult> {
    // The gSwap SDK doesn't support accepting existing swaps from order book
    // This would need to use the REST API instead
    throw new Error(
      'acceptSwap is not supported by gSwap SDK. Use REST API for order book swaps.',
    );
  }

  /**
   * Get price quote using gSwap SDK
   */
  async getQuote(
    tokenIn: ITokenClassKey,
    tokenOut: ITokenClassKey,
    amountIn: string,
  ): Promise<IGalaChainQuote> {
    try {
      const tokenInStr = formatTokenClassKey(tokenIn);
      const tokenOutStr = formatTokenClassKey(tokenOut);
      const amountInNum = Number(amountIn);

      this.logger.info(
        {
          tokenIn: tokenInStr,
          tokenOut: tokenOutStr,
          amountIn: amountInNum,
        },
        'Getting quote from gSwap SDK',
      );

      const quote = await this.gSwap.quoting.quoteExactInput(
        tokenInStr,
        tokenOutStr,
        amountInNum,
      );

      this.logger.info(
        {
          tokenIn: tokenInStr,
          tokenOut: tokenOutStr,
          amountIn: amountInNum,
          amountOut: quote.outTokenAmount.toString(),
          feeTier: quote.feeTier,
        },
        'Quote received from gSwap SDK',
      );

      return {
        amountOut: quote.outTokenAmount.toString(),
        feeTier: quote.feeTier !== undefined && quote.feeTier !== null 
          ? String(quote.feeTier) 
          : undefined,
        // SDK doesn't provide price impact directly, but we can calculate it if needed
      };
    } catch (error) {
      this.logger.error({ error, tokenIn, tokenOut, amountIn }, 'Failed to get quote from gSwap SDK');
      throw error;
    }
  }

  /**
   * Get balances using gSwap SDK's getUserAssets method
   */
  async getBalances(walletAddress?: string): Promise<readonly Readonly<{
    collection: string;
    category: string;
    type: string;
    additionalKey: string;
    quantity: string;
    lockedHolds: readonly Readonly<{
      expires: number;
      quantity: string;
    }>[];
  }>[]> {
    try {
      const address = walletAddress ?? this.walletAddress;
      this.logger.info(
        {
          walletAddress: address,
        },
        'Getting balances from gSwap SDK',
      );

      // Fetch all assets with pagination
      const allBalances: Array<{
        collection: string;
        category: string;
        type: string;
        additionalKey: string;
        quantity: string;
        lockedHolds: readonly Readonly<{
          expires: number;
          quantity: string;
        }>[];
      }> = [];

      let page = 1;
      const limit = 20; // SDK maximum limit per page
      let hasMore = true;

      while (hasMore) {
        const assets = await this.gSwap.assets.getUserAssets(address, page, limit);

        // Convert SDK token format to our balance format
        for (const token of assets.tokens) {
          // SDK returns tokens with properties like symbol, quantity, name, decimals, image
          // The SDK uses compositeKey with dollar separator: "GALA$Unit$none$none"
          const tokenAny = token as unknown as {
            compositeKey?: string;
            tokenClass?: string;
            collection?: string;
            category?: string;
            type?: string;
            additionalKey?: string;
            quantity?: string | number;
          };

          let collection = '';
          let category = 'Unit';
          let type = 'none';
          let additionalKey = 'none';

          // SDK uses compositeKey with $ separator: "Collection$Category$Type$AdditionalKey"
          if (tokenAny.compositeKey) {
            const parts = tokenAny.compositeKey.split('$');
            if (parts.length === 4) {
              collection = parts[0] ?? '';
              category = parts[1] ?? 'Unit';
              type = parts[2] ?? 'none';
              additionalKey = parts[3] ?? 'none';
            }
          } else if (tokenAny.tokenClass) {
            // Parse pipe-separated token class key: "Collection|Category|Type|AdditionalKey"
            const parts = tokenAny.tokenClass.split('|');
            if (parts.length === 4) {
              collection = parts[0] ?? '';
              category = parts[1] ?? 'Unit';
              type = parts[2] ?? 'none';
              additionalKey = parts[3] ?? 'none';
            }
          } else if (tokenAny.collection && tokenAny.category && tokenAny.type && tokenAny.additionalKey) {
            // Use direct properties if available
            collection = tokenAny.collection;
            category = tokenAny.category;
            type = tokenAny.type;
            additionalKey = tokenAny.additionalKey;
          } else {
            // Fallback: try to infer from symbol (not ideal, but better than empty)
            collection = (token as unknown as { symbol?: string }).symbol ?? '';
            this.logger.warn(
              {
                token,
                walletAddress: address,
              },
              'Token missing token class information, using symbol as collection',
            );
          }

          const balance = {
            collection,
            category,
            type,
            additionalKey,
            quantity: String(tokenAny.quantity ?? token.quantity ?? '0'),
            lockedHolds: [] as readonly Readonly<{
              expires: number;
              quantity: string;
            }>[],
          };
          allBalances.push(balance);
        }

        // Check if there are more pages
        hasMore = assets.tokens.length === limit;
        page++;
      }

      this.logger.info(
        {
          walletAddress: address,
          tokenCount: allBalances.length,
        },
        'Balances retrieved from gSwap SDK',
      );

      return allBalances;
    } catch (error) {
      this.logger.error({ error, walletAddress }, 'Failed to get balances from gSwap SDK');
      // Return empty array on error to trigger REST API fallback
      return [];
    }
  }

  /**
   * Get available swaps - SDK doesn't provide this, return empty array
   * Use REST API fallback for order book swaps
   */
  async getAvailableSwaps(
    _offeredTokenClass: Readonly<ITokenClassKey>,
    _wantedTokenClass: Readonly<ITokenClassKey>,
  ): Promise<readonly Readonly<{
    swapRequestId: string;
    offered: readonly Readonly<{
      quantity: string;
      tokenInstance: Readonly<ITokenClassKey>;
    }>[];
    wanted: readonly Readonly<{
      quantity: string;
      tokenInstance: Readonly<ITokenClassKey>;
    }>[];
    created: number;
    expires: number;
    uses: string;
    usesSpent: string;
    offeredBy: string;
  }>[]> {
    // gSwap SDK doesn't provide order book swap queries
    // Return empty array to trigger REST API fallback
    this.logger.warn('gSwap SDK does not support order book swap queries, use REST API fallback');
    return [];
  }

  /**
   * Get tokens - SDK doesn't provide this, return empty array
   * Use REST API fallback for token lists
   */
  async getTokens(_searchPrefix?: string): Promise<readonly Readonly<{
    symbol: string;
    collection: string;
    category: string;
    type: string;
    additionalKey: string;
    decimals: number;
    currentPrices: Readonly<{
      usd?: number;
    }>;
  }>[]> {
    // gSwap SDK doesn't provide token list queries
    // Return empty array to trigger REST API fallback
    this.logger.warn('gSwap SDK does not support token list queries, use REST API fallback');
    return [];
  }

  /**
   * Get swaps by wallet address - SDK doesn't provide this, return empty array
   * Use REST API fallback
   */
  async getSwapsByWalletAddress(_walletAddress: string): Promise<readonly Readonly<{
    swapRequestId: string;
    offered: readonly Readonly<{
      quantity: string;
      tokenInstance: Readonly<ITokenClassKey>;
    }>[];
    wanted: readonly Readonly<{
      quantity: string;
      tokenInstance: Readonly<ITokenClassKey>;
    }>[];
    created: number;
    expires: number;
    uses: string;
    usesSpent: string;
    offeredBy: string;
  }>[]> {
    // gSwap SDK doesn't provide swap history queries
    // Return empty array to trigger REST API fallback
    this.logger.warn('gSwap SDK does not support swap history queries, use REST API fallback');
    return [];
  }

  /**
   * Get contract name (for compatibility)
   */
  getContractName(): string {
    return 'gswap-sdk';
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.walletAddress;
  }
}
