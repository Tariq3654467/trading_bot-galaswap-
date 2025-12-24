import BigNumber from 'bignumber.js';
import { IBinanceApi, IBinanceOrder, IBinanceBalance, BinanceOrderSide, BinanceOrderType, IBinanceNewOrderParams } from './binance_api.js';
import { ILogger } from '../../types/types.js';

export interface IBinanceTrade {
  symbol: string;
  side: BinanceOrderSide;
  quantity: string;
  price?: string; // For limit orders
  type: BinanceOrderType;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

export interface IBinanceTradingConfig {
  enabled: boolean;
  minTradeAmount: number; // Minimum trade amount in quote currency (e.g., USDT)
  maxTradeAmount: number; // Maximum trade amount in quote currency
  defaultOrderType: BinanceOrderType;
  tradingPairs: readonly {
    baseAsset: string; // e.g., "GALA"
    quoteAsset: string; // e.g., "USDT"
    symbol: string; // e.g., "GALAUSDT"
    minNotional?: number; // Minimum order value
  }[];
}

export class BinanceTrading {
  constructor(
    private readonly binanceApi: IBinanceApi,
    private readonly config: IBinanceTradingConfig,
    private readonly logger?: ILogger,
  ) {}

  async getAvailableBalance(asset: string): Promise<BigNumber> {
    try {
      const balances = await this.binanceApi.getBalances();
      const balance = balances.get(asset);
      if (!balance) {
        return BigNumber(0);
      }
      return BigNumber(balance.free);
    } catch (err) {
      this.logger?.error({ message: `Failed to get Binance balance for ${asset}`, err });
      return BigNumber(0);
    }
  }

  async executeTrade(trade: IBinanceTrade): Promise<IBinanceOrder> {
    if (!this.config.enabled) {
      throw new Error('Binance trading is not enabled');
    }

    // Validate trade amount
    const tradeAmount = trade.price
      ? BigNumber(trade.quantity).multipliedBy(trade.price)
      : BigNumber(trade.quantity);

    if (tradeAmount.isLessThan(this.config.minTradeAmount)) {
      throw new Error(
        `Trade amount ${tradeAmount.toString()} is below minimum ${this.config.minTradeAmount}`,
      );
    }

    if (tradeAmount.isGreaterThan(this.config.maxTradeAmount)) {
      throw new Error(
        `Trade amount ${tradeAmount.toString()} exceeds maximum ${this.config.maxTradeAmount}`,
      );
    }

    // Check balance
    const baseAsset = this.getBaseAsset(trade.symbol);
    const quoteAsset = this.getQuoteAsset(trade.symbol);

    if (trade.side === 'BUY') {
      const quoteBalance = await this.getAvailableBalance(quoteAsset);
      const requiredQuote = trade.price
        ? BigNumber(trade.quantity).multipliedBy(trade.price)
        : BigNumber(trade.quantity); // For market orders, quantity is in quote currency

      if (quoteBalance.isLessThan(requiredQuote)) {
        throw new Error(
          `Insufficient ${quoteAsset} balance. Required: ${requiredQuote.toString()}, Available: ${quoteBalance.toString()}`,
        );
      }
    } else {
      const baseBalance = await this.getAvailableBalance(baseAsset);
      if (baseBalance.isLessThan(trade.quantity)) {
        throw new Error(
          `Insufficient ${baseAsset} balance. Required: ${trade.quantity}, Available: ${baseBalance.toString()}`,
        );
      }
    }

    // Place order
    this.logger?.info({
      message: 'Placing Binance order',
      trade,
    });

    const orderParams: Omit<IBinanceNewOrderParams, 'timestamp'> = {
      symbol: trade.symbol,
      side: trade.side,
      type: trade.type,
    };

    if (trade.type === 'MARKET') {
      if (trade.side === 'BUY') {
        // For market buy, use quoteOrderQty (amount in quote currency)
        orderParams.quoteOrderQty = trade.quantity;
      } else {
        // For market sell, use quantity (amount in base currency)
        orderParams.quantity = trade.quantity;
      }
    } else if (trade.type === 'LIMIT') {
      if (!trade.price) {
        throw new Error('Price is required for limit orders');
      }
      orderParams.quantity = trade.quantity;
      orderParams.price = trade.price;
      orderParams.timeInForce = trade.timeInForce || 'GTC';
    }

    try {
      const order = await this.binanceApi.placeOrder(orderParams);
      this.logger?.info({
        message: 'Binance order placed successfully',
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side,
        status: order.status,
      });
      return order;
    } catch (err) {
      this.logger?.error({
        message: 'Failed to place Binance order',
        trade,
        err,
      });
      throw err;
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<IBinanceOrder> {
    this.logger?.info({
      message: 'Canceling Binance order',
      symbol,
      orderId,
    });

    try {
      const canceledOrder = await this.binanceApi.cancelOrder(symbol, orderId);
      this.logger?.info({
        message: 'Binance order canceled successfully',
        orderId: canceledOrder.orderId,
        symbol: canceledOrder.symbol,
        status: canceledOrder.status,
      });
      return canceledOrder;
    } catch (err) {
      this.logger?.error({
        message: 'Failed to cancel Binance order',
        symbol,
        orderId,
        err,
      });
      throw err;
    }
  }

  async getOpenOrders(symbol?: string): Promise<readonly IBinanceOrder[]> {
    try {
      return await this.binanceApi.getOpenOrders(symbol);
    } catch (err) {
      this.logger?.error({
        message: 'Failed to get Binance open orders',
        symbol,
        err,
      });
      return [];
    }
  }

  private getBaseAsset(symbol: string): string {
    // Extract base asset from symbol (e.g., "GALA" from "GALAUSDT")
    const pair = this.config.tradingPairs.find((p) => p.symbol === symbol);
    return pair?.baseAsset || symbol.replace(/USDT|BTC|ETH|BNB$/, '');
  }

  private getQuoteAsset(symbol: string): string {
    // Extract quote asset from symbol (e.g., "USDT" from "GALAUSDT")
    const pair = this.config.tradingPairs.find((p) => p.symbol === symbol);
    return pair?.quoteAsset || 'USDT';
  }
}

