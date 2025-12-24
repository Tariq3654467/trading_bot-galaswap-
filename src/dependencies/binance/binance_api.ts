import crypto from 'crypto';
import pRetry from 'p-retry';
import util from 'util';
import { z } from 'zod';
import { ILogger } from '../../types/types.js';
import {
  binanceAccountInfoSchema,
  binanceOrderSchema,
  BinanceOrderSide,
  BinanceOrderType,
  binancePriceResponseSchema,
  IBinanceAccountInfo,
  IBinanceBalance,
  IBinanceNewOrderParams,
  IBinanceOrder,
  IBinancePrice,
} from './types.js';

// Re-export types for convenience
export type { BinanceOrderSide, BinanceOrderType, IBinanceBalance, IBinanceNewOrderParams, IBinanceOrder };

const sleep = util.promisify(setTimeout);

export class BinanceErrorResponse extends Error {
  public readonly uri: string;
  public readonly status: number;
  public readonly responseText: string;

  constructor(uri: string, status: number, responseText: string) {
    super(`Failed to fetch ${uri}: ${status} ${responseText}`);
    this.responseText = responseText;
    this.uri = uri;
    this.status = status;
  }
}

export interface IBinanceApi {
  // Price endpoints (public)
  getPrice(symbol: string): Promise<IBinancePrice | null>;
  getPrices(symbols: readonly string[]): Promise<Map<string, IBinancePrice>>;
  get24hrTicker(symbol: string): Promise<IBinancePrice | null>;
  get24hrTickers(symbols: readonly string[]): Promise<Map<string, IBinancePrice>>;
  
  // Trading endpoints (authenticated)
  getAccountInfo(): Promise<IBinanceAccountInfo>;
  getBalances(): Promise<Map<string, IBinanceBalance>>;
  placeOrder(params: Omit<IBinanceNewOrderParams, 'timestamp'>): Promise<IBinanceOrder>;
  cancelOrder(symbol: string, orderId: number, origClientOrderId?: string): Promise<IBinanceOrder>;
  getOrder(symbol: string, orderId?: number, origClientOrderId?: string): Promise<IBinanceOrder>;
  getAllOrders(symbol: string, limit?: number): Promise<readonly IBinanceOrder[]>;
  getOpenOrders(symbol?: string): Promise<readonly IBinanceOrder[]>;
}

export class BinanceApi implements IBinanceApi {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;

  constructor(
    baseUrl: string = 'https://api.binance.com',
    apiKey?: string,
    apiSecret?: string,
    private readonly fetch: typeof globalThis.fetch = globalThis.fetch,
    private readonly logger?: ILogger,
    private readonly options: { maxRetries?: number } = {},
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    if (apiKey !== undefined) {
      this.apiKey = apiKey;
    }
    if (apiSecret !== undefined) {
      this.apiSecret = apiSecret;
    }
  }

  private signRequest(queryString: string): string {
    if (!this.apiSecret) {
      throw new Error('API secret is required for signed requests');
    }
    return crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
  }

  private buildQueryString(params: Record<string, string | number | undefined>): string {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    }
    return queryParams.toString();
  }

  private async fetchJson(
    path: string,
    options: {
      method?: string;
      requiresAuth?: boolean;
      body?: unknown;
      params?: Record<string, string | number | undefined>;
    } = {},
  ) {
    const { method = 'GET', requiresAuth = false, body, params } = options;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let queryString = '';
    if (params) {
      // Add timestamp for authenticated requests
      if (requiresAuth) {
        params.timestamp = Date.now();
      }
      queryString = this.buildQueryString(params);
    }

    // Sign the request if authentication is required
    if (requiresAuth) {
      if (!this.apiKey) {
        throw new Error('API key is required for authenticated requests');
      }
      headers['X-MBX-APIKEY'] = this.apiKey;

      if (queryString) {
        const signature = this.signRequest(queryString);
        queryString += `&signature=${signature}`;
      }
    }

    const uri = `${this.baseUrl}${path}${queryString ? `?${queryString}` : ''}`;

    const response = await this.fetch(uri, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new BinanceErrorResponse(uri, response.status, responseText);
    }

    return response.json() as unknown;
  }

  async getPrice(symbol: string): Promise<IBinancePrice | null> {
    try {
      const prices = await this.getPrices([symbol]);
      return prices.get(symbol) || null;
    } catch (err) {
      this.logger?.warn({ message: `Failed to get Binance price for ${symbol}`, err });
      return null;
    }
  }

  async getPrices(symbols: readonly string[]): Promise<Map<string, IBinancePrice>> {
    if (symbols.length === 0) {
      return new Map();
    }

    // Binance supports multiple symbols with comma-separated list
    // Format: /api/v3/ticker/price?symbols=["BTCUSDT","ETHUSDT"]
    const symbolParam = symbols.map((s) => `"${s}"`).join(',');
    const path = `/api/v3/ticker/price?symbols=[${symbolParam}]`;

    try {
      const result = await this.retry(() => this.fetchJson(path));
      
      // Handle both single object and array responses
      const pricesArray = Array.isArray(result) ? result : [result];
      const prices = binancePriceResponseSchema.parse(pricesArray);
      const priceMap = new Map<string, IBinancePrice>();

      for (const price of prices) {
        priceMap.set(price.symbol, price);
      }

      return priceMap;
    } catch (err) {
      this.logger?.warn({ message: 'Failed to get Binance prices', err, symbols });
      // Fallback: try fetching individually
      return this.getPricesFallback(symbols);
    }
  }

  private async getPricesFallback(symbols: readonly string[]): Promise<Map<string, IBinancePrice>> {
    const priceMap = new Map<string, IBinancePrice>();

    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const path = `/api/v3/ticker/price?symbol=${symbol}`;
          const result = await this.retry(() => this.fetchJson(path));
          const prices = binancePriceResponseSchema.parse([result]);
          const price = prices[0];
          if (price) {
            priceMap.set(symbol, price);
          }
        } catch (err) {
          this.logger?.warn({ message: `Failed to get Binance price for ${symbol}`, err });
        }
      }),
    );

    return priceMap;
  }

  async get24hrTicker(symbol: string): Promise<IBinancePrice | null> {
    try {
      const tickers = await this.get24hrTickers([symbol]);
      return tickers.get(symbol) || null;
    } catch (err) {
      this.logger?.warn({ message: `Failed to get Binance 24hr ticker for ${symbol}`, err });
      return null;
    }
  }

  async get24hrTickers(symbols: readonly string[]): Promise<Map<string, IBinancePrice>> {
    if (symbols.length === 0) {
      return new Map();
    }

    // Binance 24hr ticker endpoint doesn't support multiple symbols in one call efficiently
    // So we'll fetch them individually and combine
    const tickerMap = new Map<string, IBinancePrice>();

    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const path = `/api/v3/ticker/24hr?symbol=${symbol}`;
          const result = await this.retry(() => this.fetchJson(path));
          // The 24hr ticker returns a single object, not an array
          // Extract price from the ticker object
          if (result && typeof result === 'object' && 'price' in result) {
            const priceData: IBinancePrice = {
              symbol: symbol,
              price: String((result as { price: unknown }).price),
            };
            tickerMap.set(symbol, priceData);
          }
        } catch (err) {
          this.logger?.warn({ message: `Failed to get 24hr ticker for ${symbol}`, err });
        }
      }),
    );

    return tickerMap;
  }

  // Trading endpoints (authenticated)

  async getAccountInfo(): Promise<IBinanceAccountInfo> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API key and secret are required for account info');
    }

    const result = await this.retry(() =>
      this.fetchJson('/api/v3/account', {
        method: 'GET',
        requiresAuth: true,
      }),
    );

    return binanceAccountInfoSchema.parse(result);
  }

  async getBalances(): Promise<Map<string, IBinanceBalance>> {
    const accountInfo = await this.getAccountInfo();
    const balanceMap = new Map<string, IBinanceBalance>();

    for (const balance of accountInfo.balances) {
      balanceMap.set(balance.asset, balance);
    }

    return balanceMap;
  }

  async placeOrder(params: Omit<IBinanceNewOrderParams, 'timestamp'>): Promise<IBinanceOrder> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API key and secret are required for placing orders');
    }

    const timestamp = Date.now();

    // Convert to Record for params
    const paramsRecord: Record<string, string | number | undefined> = {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      timestamp: timestamp,
    };

    if (params.quantity !== undefined) {
      paramsRecord.quantity = params.quantity;
    }
    if (params.quoteOrderQty !== undefined) {
      paramsRecord.quoteOrderQty = params.quoteOrderQty;
    }
    if (params.price !== undefined) {
      paramsRecord.price = params.price;
    }
    if (params.timeInForce !== undefined) {
      paramsRecord.timeInForce = params.timeInForce;
    }
    if (params.stopPrice !== undefined) {
      paramsRecord.stopPrice = params.stopPrice;
    }
    if (params.icebergQty !== undefined) {
      paramsRecord.icebergQty = params.icebergQty;
    }
    if (params.newClientOrderId !== undefined) {
      paramsRecord.newClientOrderId = params.newClientOrderId;
    }
    if (params.recvWindow !== undefined) {
      paramsRecord.recvWindow = params.recvWindow;
    }

    const result = await this.retry(() =>
      this.fetchJson('/api/v3/order', {
        method: 'POST',
        requiresAuth: true,
        params: paramsRecord,
      }),
    );

    return binanceOrderSchema.parse(result);
  }

  async cancelOrder(
    symbol: string,
    orderId?: number,
    origClientOrderId?: string,
  ): Promise<IBinanceOrder> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API key and secret are required for canceling orders');
    }

    const params: Record<string, string | number> = {
      symbol,
      timestamp: Date.now(),
    };

    if (orderId !== undefined) {
      params.orderId = orderId;
    } else if (origClientOrderId) {
      params.origClientOrderId = origClientOrderId;
    } else {
      throw new Error('Either orderId or origClientOrderId must be provided');
    }

    const result = await this.retry(() =>
      this.fetchJson('/api/v3/order', {
        method: 'DELETE',
        requiresAuth: true,
        params,
      }),
    );

    return binanceOrderSchema.parse(result);
  }

  async getOrder(
    symbol: string,
    orderId?: number,
    origClientOrderId?: string,
  ): Promise<IBinanceOrder> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API key and secret are required for getting order info');
    }

    const params: Record<string, string | number> = {
      symbol,
      timestamp: Date.now(),
    };

    if (orderId !== undefined) {
      params.orderId = orderId;
    } else if (origClientOrderId) {
      params.origClientOrderId = origClientOrderId;
    } else {
      throw new Error('Either orderId or origClientOrderId must be provided');
    }

    const result = await this.retry(() =>
      this.fetchJson('/api/v3/order', {
        method: 'GET',
        requiresAuth: true,
        params,
      }),
    );

    return binanceOrderSchema.parse(result);
  }

  async getAllOrders(symbol: string, limit: number = 500): Promise<readonly IBinanceOrder[]> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API key and secret are required for getting orders');
    }

    const result = await this.retry(() =>
      this.fetchJson('/api/v3/allOrders', {
        method: 'GET',
        requiresAuth: true,
        params: {
          symbol,
          limit,
          timestamp: Date.now(),
        },
      }),
    );

    return z.array(binanceOrderSchema).parse(result);
  }

  async getOpenOrders(symbol?: string): Promise<readonly IBinanceOrder[]> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API key and secret are required for getting open orders');
    }

    const params: Record<string, string | number> = {
      timestamp: Date.now(),
    };

    if (symbol) {
      params.symbol = symbol;
    }

    const result = await this.retry(() =>
      this.fetchJson('/api/v3/openOrders', {
        method: 'GET',
        requiresAuth: true,
        params,
      }),
    );

    return z.array(binanceOrderSchema).parse(result);
  }

  private retry<TResponseType>(fn: () => Promise<TResponseType>) {
    return pRetry(fn, {
      retries: this.options.maxRetries ?? 5,
      onFailedAttempt: async (err: unknown) => {
        this.logger?.warn({
          message: 'Binance API failed request',
          err,
        });

        await sleep(250);
      },
      shouldRetry: async (err: unknown): Promise<boolean> => {
        if (
          err instanceof BinanceErrorResponse &&
          err.status < 500 &&
          err.status !== 400 &&
          err.status !== 404 &&
          err.status !== 429
        ) {
          // Non-retriable error
          return false;
        }

        if (err instanceof BinanceErrorResponse && err.status === 429) {
          this.logger?.warn({
            message: 'Binance API rate limited',
            err: err.responseText,
          });

          await sleep(10_000);
        }

        return true;
      },
    });
  }
}

