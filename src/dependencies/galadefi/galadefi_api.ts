import crypto from 'crypto';
import pRetry from 'p-retry';
import util from 'util';
import { ethers } from 'ethers';
import { ILogger, ITokenClassKey } from '../../types/types.js';
import { signObject } from '../galaswap/galachain_signing.js';
import {
  IQuoteRequest,
  IQuoteResponse,
  ISwapRequest,
  ISwapResponse,
  ITradingPair,
  IMarketPrice,
  IAddLiquidityRequest,
  IRemoveLiquidityRequest,
  ILiquidityResponse,
  IBalanceResponse,
  quoteRequestSchema,
  quoteResponseSchema,
  swapRequestSchema,
  swapResponseSchema,
  tradingPairsResponseSchema,
  marketPricesResponseSchema,
  liquidityResponseSchema,
  balanceResponseSchema,
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
  // Trading endpoints
  getTradingPairs(): Promise<readonly ITradingPair[]>;
  getQuote(request: IQuoteRequest): Promise<IQuoteResponse>;
  executeSwap(request: ISwapRequest): Promise<ISwapResponse>;
  
  // Market data
  getMarketPrices(): Promise<readonly IMarketPrice[]>;
  
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
    options: { body?: unknown } = {},
  ) {
    const authHeaders = requiresSignature
      ? {
          'X-Wallet-Address': this.walletAddress,
        }
      : {};

    const body = requiresSignature
      ? signObject(
          {
            ...(options.body ?? {}),
            signerPublicKey: this.signerPublicKey,
            uniqueKey: `galadefi-operation-${crypto.randomUUID()}`,
          },
          this.privateKey,
        )
      : options.body;

    const uri = `${this.baseUrl}${path}`;

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
    const result = await this.retry(() => this.fetchJson('/v1/trading/pairs', 'GET', false));
    const parsed = tradingPairsResponseSchema.parse(result);
    return parsed.pairs;
  }

  async getQuote(request: IQuoteRequest): Promise<IQuoteResponse> {
    quoteRequestSchema.parse(request);
    const result = await this.retry(() =>
      this.fetchJson('/v1/trading/quote', 'POST', false, { body: request }),
    );
    return quoteResponseSchema.parse(result);
  }

  async executeSwap(request: ISwapRequest): Promise<ISwapResponse> {
    swapRequestSchema.parse(request);
    
    // Add default deadline if not provided (1 hour from now)
    const swapRequestWithDefaults: ISwapRequest = {
      ...request,
      deadline: request.deadline ?? Math.floor(Date.now() / 1000) + 3600,
      recipient: request.recipient ?? this.walletAddress,
    };

    const result = await this.retry(() =>
      this.fetchJson('/v1/trading/swap', 'POST', true, { body: swapRequestWithDefaults }),
    );
    return swapResponseSchema.parse(result);
  }

  async getMarketPrices(): Promise<readonly IMarketPrice[]> {
    const result = await this.retry(() => this.fetchJson('/v1/market/prices', 'GET', false));
    const parsed = marketPricesResponseSchema.parse(result);
    return parsed.prices;
  }

  async addLiquidity(request: IAddLiquidityRequest): Promise<ILiquidityResponse> {
    const liquidityRequestWithDefaults: IAddLiquidityRequest = {
      ...request,
      deadline: request.deadline ?? Math.floor(Date.now() / 1000) + 3600,
    };

    const result = await this.retry(() =>
      this.fetchJson('/v1/liquidity/add', 'POST', true, { body: liquidityRequestWithDefaults }),
    );
    return liquidityResponseSchema.parse(result);
  }

  async removeLiquidity(request: IRemoveLiquidityRequest): Promise<ILiquidityResponse> {
    const liquidityRequestWithDefaults: IRemoveLiquidityRequest = {
      ...request,
      deadline: request.deadline ?? Math.floor(Date.now() / 1000) + 3600,
    };

    const result = await this.retry(() =>
      this.fetchJson('/v1/liquidity/remove', 'POST', true, { body: liquidityRequestWithDefaults }),
    );
    return liquidityResponseSchema.parse(result);
  }

  async getBalances(): Promise<IBalanceResponse> {
    const result = await this.retry(() =>
      this.fetchJson('/v1/user/balances', 'GET', true),
    );
    return balanceResponseSchema.parse(result);
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

