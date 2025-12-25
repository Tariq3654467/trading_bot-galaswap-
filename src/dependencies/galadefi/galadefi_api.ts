import crypto from 'crypto';
import { ethers } from 'ethers';
import pRetry from 'p-retry';
import util from 'util';
import { ILogger, ITokenClassKey } from '../../types/types.js';
import { signObject } from '../galaswap/galachain_signing.js';
import {
  balanceResponseSchema,
  bundleResponseSchema,
  formatTokenForV3,
  IAddLiquidityRequest,
  IBalanceResponse,
  ILiquidityResponse,
  IMultiplePricesRequest,
  IPoolResponse,
  IPositionsResponse,
  IPriceOracleRequest,
  IPriceOracleResponse,
  IQuoteRequest,
  IQuoteResponse,
  IRemoveLiquidityRequest,
  ISinglePriceResponse,
  ISwapRequest,
  ISwapResponse,
  ITradingPair,
  liquidityPayloadSchema,
  multiplePricesRequestSchema,
  multiplePricesResponseSchema,
  poolResponseSchema,
  positionsResponseSchema,
  priceOracleRequestSchema,
  priceOracleResponseSchema,
  quoteRequestSchema,
  quoteResponseSchema,
  singlePriceResponseSchema,
  swapPayloadSchema,
  swapRequestSchema,
  tradingPairsResponseSchema
} from './types.js';

const sleep = util.promisify(setTimeout);

export class GalaDeFiErrorResponse extends Error {
  public readonly uri: string;
  public readonly status: number;
  public readonly errorCode: string;
  public readonly responseText: string;

  private static parseJsonOrUndefined(responseText: string) {
    try {
      return JSON.parse(responseText);
    } catch (e) {
      return undefined;
    }
  }

  constructor(uri: string, status: number, responseText: string) {
    super(`Failed to fetch ${uri}: ${status} ${responseText}`);

    this.responseText = responseText;
    this.uri = uri;
    this.status = status;

    const responseBody = GalaDeFiErrorResponse.parseJsonOrUndefined(responseText);
    this.errorCode = responseBody?.error?.ErrorKey ?? responseBody?.error ?? 'UNKNOWN_ERROR';
  }
}

export interface IGalaDeFiApi {
  // Trading endpoints (V3 Protocol)
  getTradingPairs(): Promise<readonly ITradingPair[]>;
  getQuote(request: IQuoteRequest): Promise<IQuoteResponse>;
  executeSwap(request: ISwapRequest): Promise<ISwapResponse>;
  
  // Market data (V3 Protocol)
  getPrice(token: string): Promise<ISinglePriceResponse>;
  getMarketPrices(tokens?: readonly string[]): Promise<readonly string[]>;
  
  // Price Oracle (V3 Protocol)
  fetchPrice(
    token: ITokenClassKey,
    page?: number,
    limit?: number,
    order?: 'asc' | 'desc',
    at?: string,
    from?: string,
    to?: string,
  ): Promise<IPriceOracleResponse>;
  subscribeTokenPrice(token: ITokenClassKey, subscribe: boolean): Promise<void>;
  
  // Positions (V3 Protocol)
  getPositions(user: string, limit: number, bookmark?: string): Promise<IPositionsResponse>;
  getPosition(
    token0: string,
    token1: string,
    fee: number,
    tickLower: number,
    tickUpper: number,
    owner: string,
  ): Promise<IPositionsResponse>;
  
  // Pool (V3 Protocol)
  getPool(token0: string, token1: string, fee: number): Promise<IPoolResponse>;
  
  // Liquidity management
  addLiquidity(request: IAddLiquidityRequest): Promise<ILiquidityResponse>;
  removeLiquidity(request: IRemoveLiquidityRequest): Promise<ILiquidityResponse>;
  
  // Balance
  getBalances(): Promise<IBalanceResponse>;
}

export class GalaDeFiApi implements IGalaDeFiApi {
  private readonly signerPublicKey: string;

  constructor(
    private readonly baseUrl: string,
    private readonly walletAddress: string,
    private readonly privateKey: string,
    private readonly fetch: typeof globalThis.fetch,
    private readonly logger: ILogger,
    private readonly options: { maxRetries?: number } = {},
  ) {
    const publicKeyHex = ethers.SigningKey.computePublicKey(privateKey, true);
    const publicKeyBase64 = Buffer.from(publicKeyHex.replace('0x', ''), 'hex').toString('base64');
    this.signerPublicKey = publicKeyBase64;
  }

  private async fetchJson(
    path: string,
    method: string,
    requiresSignature: boolean,
    options: { body?: unknown; queryParams?: Record<string, string | number> } = {},
  ) {
    const authHeaders = requiresSignature
      ? {
          'X-Wallet-Address': this.walletAddress,
        }
      : {};

    // Build query string if queryParams provided
    let fullPath = path;
    if (options.queryParams && Object.keys(options.queryParams).length > 0) {
      const queryString = new URLSearchParams(
        Object.entries(options.queryParams).reduce(
          (acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          },
          {} as Record<string, string>,
        ),
      ).toString();
      fullPath = `${path}${path.includes('?') ? '&' : '?'}${queryString}`;
    }

    const body = requiresSignature && options.body
      ? signObject(
          {
            ...(options.body as Record<string, unknown>),
            signerPublicKey: this.signerPublicKey,
            uniqueKey: `galadefi-operation-${crypto.randomUUID()}`,
          },
          this.privateKey,
        )
      : options.body;

    const uri = `${this.baseUrl}${fullPath}`;

    const response = await this.fetch(uri, {
      method,
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });

    if (!response.ok) {
      throw new GalaDeFiErrorResponse(uri, response.status, await response.text());
    }

    return response.json() as unknown;
  }

  async getTradingPairs(): Promise<readonly ITradingPair[]> {
    // V3 Protocol: /trade/pairs endpoint
    const result = await this.retry(() => this.fetchJson('/trade/pairs', 'GET', false));
    const parsed = tradingPairsResponseSchema.parse(result);
    return parsed.pairs;
  }

  async getQuote(request: IQuoteRequest): Promise<IQuoteResponse> {
    quoteRequestSchema.parse(request);
    // V3 Protocol: GET /v1/trade/quote with query parameters
    const queryParams: Record<string, string | number> = {
      tokenIn: request.tokenIn,
      tokenOut: request.tokenOut,
    };
    if (request.amountIn) queryParams.amountIn = request.amountIn;
    if (request.amountOut) queryParams.amountOut = request.amountOut;
    if (request.fee !== undefined) queryParams.fee = request.fee;

    const result = await this.retry(() =>
      this.fetchJson('/v1/trade/quote', 'GET', false, { queryParams }),
    );
    return quoteResponseSchema.parse(result);
  }

  async executeSwap(request: ISwapRequest): Promise<ISwapResponse> {
    swapRequestSchema.parse(request);
    
    // V3 Protocol: Two-step process
    // Step 1: Generate swap payload via POST /v1/trade/swap
    // Format tokens as strings (pipe-separated format matching gSwap SDK)
    const swapPayloadRequest = {
      tokenIn: formatTokenForV3(request.tokenIn),
      tokenOut: formatTokenForV3(request.tokenOut),
      amountIn: request.amountIn,
      amountOut: request.amountOut,
      fee: request.fee,
      sqrtPriceLimit: request.sqrtPriceLimit,
      amountInMaximum: request.amountInMaximum,
      amountOutMinimum: request.amountOutMinimum,
    };

    const payloadResult = await this.retry(() =>
      this.fetchJson('/v1/trade/swap', 'POST', false, { body: swapPayloadRequest }),
    );
    const payload = swapPayloadSchema.parse(payloadResult);

    // Step 2: Sign the payload and submit to bundle endpoint
    const signedPayload = signObject(payload.data, this.privateKey);
    const signature = signedPayload.signature;

    const bundleRequest = {
      payload: payload.data,
      type: 'swap',
      signature,
      user: `eth|${this.walletAddress}`,
    };

    const bundleResult = await this.retry(() =>
      this.fetchJson('/v1/trade/bundle', 'POST', false, { body: bundleRequest }),
    );
    const bundle = bundleResponseSchema.parse(bundleResult);

    return {
      transactionId: bundle.data.data,
      status: 'pending' as const,
      timestamp: Date.now(),
    };
  }

  async getMarketPrices(tokens?: readonly string[]): Promise<readonly string[]> {
    // V3 Protocol: POST /v1/trade/price-multiple for multiple tokens
    if (tokens && tokens.length > 0) {
      const request: IMultiplePricesRequest = { tokens: [...tokens] };
      multiplePricesRequestSchema.parse(request);
      const result = await this.retry(() =>
        this.fetchJson('/v1/trade/price-multiple', 'POST', false, { body: request }),
      );
      const parsed = multiplePricesResponseSchema.parse(result);
      return parsed.data;
    }
    return [];
  }

  async getPrice(token: string): Promise<ISinglePriceResponse> {
    // V3 Protocol: GET /v1/trade/price for single token
    const result = await this.retry(() =>
      this.fetchJson('/v1/trade/price', 'GET', false, {
        queryParams: { token },
      }),
    );
    return singlePriceResponseSchema.parse(result);
  }

  async addLiquidity(request: IAddLiquidityRequest): Promise<ILiquidityResponse> {
    // V3 Protocol: Two-step process
    // Step 1: Generate liquidity payload via POST /v1/trade/liquidity
    const payloadResult = await this.retry(() =>
      this.fetchJson('/v1/trade/liquidity', 'POST', false, { body: request }),
    );
    const payload = liquidityPayloadSchema.parse(payloadResult);

    // Step 2: Sign the payload and submit to bundle endpoint
    const signedPayload = signObject(payload.data, this.privateKey);
    const signature = signedPayload.signature;

    const bundleRequest = {
      payload: payload.data,
      type: 'addLiquidity',
      signature,
      user: `eth|${this.walletAddress}`,
    };

    const bundleResult = await this.retry(() =>
      this.fetchJson('/v1/trade/bundle', 'POST', false, { body: bundleRequest }),
    );
    const bundle = bundleResponseSchema.parse(bundleResult);

    return {
      transactionId: bundle.data.data,
      status: 'pending' as const,
      timestamp: Date.now(),
    };
  }

  async removeLiquidity(request: IRemoveLiquidityRequest): Promise<ILiquidityResponse> {
    // V3 Protocol: Two-step process
    // Step 1: Generate remove liquidity payload via DELETE /v1/trade/liquidity
    const payloadResult = await this.retry(() =>
      this.fetchJson('/v1/trade/liquidity', 'DELETE', false, { body: request }),
    );
    const payload = liquidityPayloadSchema.parse(payloadResult);

    // Step 2: Sign the payload and submit to bundle endpoint
    const signedPayload = signObject(payload.data, this.privateKey);
    const signature = signedPayload.signature;

    const bundleRequest = {
      payload: payload.data,
      type: 'removeLiquidity',
      signature,
      user: `eth|${this.walletAddress}`,
    };

    const bundleResult = await this.retry(() =>
      this.fetchJson('/v1/trade/bundle', 'POST', false, { body: bundleRequest }),
    );
    const bundle = bundleResponseSchema.parse(bundleResult);

    return {
      transactionId: bundle.data.data,
      status: 'pending' as const,
      timestamp: Date.now(),
    };
  }

  async getBalances(): Promise<IBalanceResponse> {
    const result = await this.retry(() =>
      this.fetchJson('/v1/user/balances', 'GET', true),
    );
    return balanceResponseSchema.parse(result);
  }

  // Price Oracle endpoints (V3 Protocol)

  async fetchPrice(
    token: ITokenClassKey,
    page?: number,
    limit?: number,
    order?: 'asc' | 'desc',
    at?: string,
    from?: string,
    to?: string,
  ): Promise<IPriceOracleResponse> {
    // V3 Protocol: POST /price-oracle/fetch-price with body
    const tokenString = formatTokenForV3(token);
    const request: IPriceOracleRequest = {
      token: tokenString,
      page,
      limit,
      order,
      at,
      from,
      to,
    };
    priceOracleRequestSchema.parse(request);
    
    const result = await this.retry(() =>
      this.fetchJson('/price-oracle/fetch-price', 'POST', false, { body: request }),
    );
    
    return priceOracleResponseSchema.parse(result);
  }

  async subscribeTokenPrice(token: ITokenClassKey, subscribe: boolean): Promise<void> {
    await this.retry(() =>
      this.fetchJson('/price-oracle/subscribe-token', 'POST', true, {
        body: {
          subscribe,
          token: {
            collection: token.collection,
            category: token.category,
            type: token.type,
            additionalKey: token.additionalKey,
          },
        },
      }),
    );
  }

  // Positions endpoints (V3 Protocol)

  async getPositions(user: string, limit: number, bookmark?: string): Promise<IPositionsResponse> {
    const queryParams: Record<string, string | number> = {
      user: `eth|${user}`,
      limit,
    };
    if (bookmark) queryParams.bookmark = bookmark;

    const result = await this.retry(() =>
      this.fetchJson('/v1/trade/positions', 'GET', false, { queryParams }),
    );
    return positionsResponseSchema.parse(result);
  }

  async getPosition(
    token0: string,
    token1: string,
    fee: number,
    tickLower: number,
    tickUpper: number,
    owner: string,
  ): Promise<IPositionsResponse> {
    const queryParams: Record<string, string | number> = {
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
      owner: `eth|${owner}`,
    };

    const result = await this.retry(() =>
      this.fetchJson('/v1/trade/position', 'GET', false, { queryParams }),
    );
    return positionsResponseSchema.parse(result);
  }

  // Pool endpoint (V3 Protocol)

  async getPool(token0: string, token1: string, fee: number): Promise<IPoolResponse> {
    const queryParams: Record<string, string | number> = {
      token0,
      token1,
      fee,
    };

    const result = await this.retry(() =>
      this.fetchJson('/v1/trade/pool', 'GET', false, { queryParams }),
    );
    return poolResponseSchema.parse(result);
  }

  private retry<TResponseType>(fn: () => Promise<TResponseType>) {
    return pRetry(fn, {
      retries: this.options.maxRetries ?? 5,
      onFailedAttempt: async (err: unknown) => {
        this.logger.warn({
          message: 'GalaDeFi API failed request',
          err,
        });

        await sleep(250);
      },
      shouldRetry: async (err: unknown): Promise<boolean> => {
        if (
          err instanceof GalaDeFiErrorResponse &&
          err.status < 500 &&
          err.status !== 400 &&
          err.status !== 404 &&
          err.status !== 429
        ) {
          // Non-retriable error
          return false;
        }

        if (err instanceof GalaDeFiErrorResponse && err.status === 429) {
          this.logger.warn({
            message: 'GalaDeFi API rate limited',
            err: err.responseText,
          });

          await sleep(10_000);
        }

        return true;
      },
    });
  }
}

