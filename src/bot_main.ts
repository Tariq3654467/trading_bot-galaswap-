import assert from 'assert';
import { MongoClient } from 'mongodb';
import pino from 'pino';
import util from 'util';
import { EnvironmentVariableConfigurationManager } from './configuration_manager.js';
import { MongoAcceptedSwapStore } from './dependencies/accepted_swap_store.js';
import { BinanceApi } from './dependencies/binance/binance_api.js';
import { BinanceTrading, IBinanceTradingConfig } from './dependencies/binance/binance_trading.js';
import { MongoCreatedSwapStore } from './dependencies/created_swap_store.js';
import { GalaDeFiApi } from './dependencies/galadefi/galadefi_api.js';
import { GalaSwapApi } from './dependencies/galaswap/galaswap_api.js';
import { MongoPriceStore } from './dependencies/price_store.js';
import {
  ConsoleStatusReporter,
  DiscordStatusReporter,
  IStatusReporter,
  SlackWebhookStatusReporter,
} from './dependencies/status_reporters.js';
import { BasicSwapAccepterStrategy } from './strategies/basic_swap_accepter/basic_swap_accepter_strategy.js';
import { BasicSwapCreatorStrategy } from './strategies/basic_swap_creator/basic_swap_creator_strategy.js';
import { mainLoop } from './tick_loop.js';
import { defaultTokenConfig } from './token_config.js';
import { ILogger } from './types/types.js';
import './utils/big_number_safety_extensions.js';

const sleep = util.promisify(setTimeout);

const strategiesToUse = [new BasicSwapAccepterStrategy(), new BasicSwapCreatorStrategy()];

async function main(logger: ILogger) {
  const configuration = new EnvironmentVariableConfigurationManager();

  /* Settings */

  const loopWaitMsString = await configuration.getOptionalWithDefault('LOOP_WAIT_MS', '15000');
  const mongoUri = await configuration.getRequired('MONGO_URI');
  const selfWalletAddress = await configuration.getRequired('GALA_WALLET_ADDRESS');
  const selfPrivateKey = await configuration.getRequired('GALA_PRIVATE_KEY');
  const slackInfoWebhookUri = await configuration.getOptional('SLACK_WEBHOOK_URI');
  const slackAlertWebhookUri =
    (await configuration.getOptional('SLACK_ALERT_WEBHOOK_URI')) ?? slackInfoWebhookUri;
  const discordInfoWebhookUri = await configuration.getOptional('DISCORD_WEBHOOK_URI');
  const discordAlertWebhookUri =
    (await configuration.getOptional('DISCORD_ALERT_WEBHOOK_URI')) ?? discordInfoWebhookUri;

  const galaSwapApiBaseUri = await configuration.getOptionalWithDefault(
    'GALASWAP_API_BASE_URI',
    'https://api-galaswap.gala.com',
  );

  // GalaSwap API timeout configuration
  const galaSwapRequestTimeoutMs = Number(
    await configuration.getOptionalWithDefault('GALASWAP_REQUEST_TIMEOUT_MS', '30000'),
  );
  const galaSwapConnectTimeoutMs = Number(
    await configuration.getOptionalWithDefault('GALASWAP_CONNECT_TIMEOUT_MS', '15000'),
  );

  // GalaDeFi DEX API configuration
  const galaDeFiEnabled = (await configuration.getOptionalWithDefault('GALADEFI_ENABLED', 'false')) === 'true';
  const galaDeFiApiBaseUri = await configuration.getOptionalWithDefault(
    'GALADEFI_API_BASE_URI',
    'https://dex-backend-prod1.defi.gala.com',
  );

  // Binance configuration
  const binanceEnabled = (await configuration.getOptionalWithDefault('BINANCE_ENABLED', 'false')) === 'true';
  const binanceApiBaseUri = await configuration.getOptionalWithDefault(
    'BINANCE_API_BASE_URI',
    'https://api.binance.com',
  );
  const binanceApiKey = await configuration.getOptional('BINANCE_API_KEY');
  const binanceApiSecret = await configuration.getOptional('BINANCE_API_SECRET');

  const executionDelayEnvVar = await configuration.getOptionalWithDefault(
    'EXECUTION_DELAY_MS',
    '0',
  );

  const ignoreSwapsCreatedBeforeEnvVar = await configuration.getOptionalWithDefault(
    'IGNORE_SWAPS_CREATED_BEFORE',
    '0',
  );

  const delayBeforeExecuteMs = Number(executionDelayEnvVar);
  assert(
    Number.isInteger(delayBeforeExecuteMs) && delayBeforeExecuteMs >= 0,
    'EXECUTION_DELAY_MS must be a positive integer',
  );

  const ignoreSwapsCreatedBefore = new Date(ignoreSwapsCreatedBeforeEnvVar);
  assert(
    ignoreSwapsCreatedBefore.getTime() >= 0,
    'IGNORE_SWAPS_CREATED_BEFORE must be a valid date',
  );

  const loopWaitMs = Number(loopWaitMsString);
  assert(
    Number.isInteger(loopWaitMs) && loopWaitMs >= 0,
    'LOOP_WAIT_MS must be a non-negative integer',
  );

  /* End of settings */

  /* Dependencies */

  const mongoClient = new MongoClient(mongoUri);
  const db = mongoClient.db();
  const createdSwapStore = new MongoCreatedSwapStore(db);
  const acceptedSwapStore = new MongoAcceptedSwapStore(db);
  const priceStore = new MongoPriceStore(db);

  await Promise.all([createdSwapStore.init(), acceptedSwapStore.init(), priceStore.init()]);

  const galaSwapApi = new GalaSwapApi(
    galaSwapApiBaseUri,
    selfWalletAddress,
    selfPrivateKey,
    fetch,
    logger,
    {
      requestTimeoutMs: galaSwapRequestTimeoutMs,
      connectTimeoutMs: galaSwapConnectTimeoutMs,
    },
  );

  // Initialize GalaDeFi DEX API if enabled
  const galaDeFiApi = galaDeFiEnabled
    ? new GalaDeFiApi(galaDeFiApiBaseUri, selfWalletAddress, selfPrivateKey, fetch, logger)
    : null;

  if (galaDeFiApi) {
    logger.info('GalaDeFi DEX API enabled and initialized');
  }

  // Initialize Binance API if enabled
  const binanceApi = binanceEnabled
    ? new BinanceApi(binanceApiBaseUri, binanceApiKey, binanceApiSecret, fetch, logger)
    : null;

  // Initialize Binance Trading if enabled
  let binanceTrading: BinanceTrading | null = null;
  if (binanceApi && defaultTokenConfig.binance?.trading?.enabled) {
    if (!binanceApiKey || !binanceApiSecret) {
      logger.warn('Binance trading is enabled but API key/secret not provided. Trading will be disabled.');
    } else {
      const tradingConfig: IBinanceTradingConfig = {
        enabled: defaultTokenConfig.binance.trading.enabled,
        minTradeAmount: defaultTokenConfig.binance.trading.minTradeAmount,
        maxTradeAmount: defaultTokenConfig.binance.trading.maxTradeAmount,
        defaultOrderType: defaultTokenConfig.binance.trading.defaultOrderType,
        tradingPairs: defaultTokenConfig.binance.trading.tradingPairs.map((p: { baseAsset: string; quoteAsset: string; symbol: string; minNotional?: number | undefined }) => {
          const pair: { baseAsset: string; quoteAsset: string; symbol: string; minNotional?: number } = {
            baseAsset: p.baseAsset,
            quoteAsset: p.quoteAsset,
            symbol: p.symbol,
          };
          if (p.minNotional !== undefined) {
            pair.minNotional = p.minNotional;
          }
          return pair;
        }),
      };
      binanceTrading = new BinanceTrading(binanceApi, tradingConfig, logger);
      logger.info('Binance trading enabled and initialized');
    }
  }

  if (binanceApi) {
    logger.info('Binance API enabled and initialized');
  }

  let reporter: IStatusReporter = new ConsoleStatusReporter();

  if (slackInfoWebhookUri) {
    reporter = new SlackWebhookStatusReporter(slackInfoWebhookUri, slackAlertWebhookUri!);
  } else if (discordInfoWebhookUri) {
    reporter = new DiscordStatusReporter(discordInfoWebhookUri, discordAlertWebhookUri!);
  }

  /* End of dependencies */

  // Liftoff...

  console.log('Started');

  try {
    await mainLoop(
      loopWaitMs,
      selfWalletAddress,
      logger,
      galaSwapApi,
      reporter,
      createdSwapStore,
      acceptedSwapStore,
      priceStore,
      strategiesToUse,
      delayBeforeExecuteMs,
      {
        ignoreSwapsCreatedBefore,
        binanceApi,
        binanceTrading,
        galaDeFiApi,
        tokenConfig: defaultTokenConfig,
      },
    );
  } catch (err) {
    logger.error(err);
    try {
      await reporter.sendAlert('Entering eternal sleep due to error - reboot me');
    } catch (err) {
      logger.error(err);
    }

    while (true) {
      await sleep(10_000);
    }
  }
}

const logger = pino();

main(logger)
  .then(() => {
    logger.info('Main loop exited');
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
