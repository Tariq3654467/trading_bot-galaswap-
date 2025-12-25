import fs from 'fs';
import path from 'path';
import { MongoAcceptedSwapStore } from '../../dependencies/accepted_swap_store.js';
import { MongoCreatedSwapStore } from '../../dependencies/created_swap_store.js';
import {
  IGalaSwapApi,
  IGalaSwapToken,
  IRawSwap,
  ITokenBalance,
} from '../../dependencies/galaswap/types.js';
import { GalaChainRouter } from '../../dependencies/onchain/galachain_router.js';
import { MongoPriceStore } from '../../dependencies/price_store.js';
import { IStatusReporter } from '../../dependencies/status_reporters.js';
import { stringifyTokenClass } from '../../types/type_helpers.js';
import { ILogger, ITokenClassKey } from '../../types/types.js';
import { ISwapStrategy } from '../swap_strategy.js';
import { getSwapsToAccept } from './get_swap_to_accept.js';
import { basicSwapAccepterConfigSchema } from './types.js';

const dirname = import.meta.dirname;
const rawConfig = JSON.parse(
  fs.readFileSync(
    path.join(dirname, '..', '..', '..', 'config', 'basic_swap_accepter.json'),
    'utf8',
  ),
);

export const defaultBasicSwapAccepterConfig = basicSwapAccepterConfigSchema.parse(rawConfig);

export class BasicSwapAccepterStrategy implements ISwapStrategy {
  constructor(private readonly config = defaultBasicSwapAccepterConfig) {}

  async doTick(
    _logger: ILogger,
    reporter: IStatusReporter,
    selfUserId: string,
    galaSwapApi: IGalaSwapApi,
    _createdSwapStore: MongoCreatedSwapStore,
    acceptedSwapStore: MongoAcceptedSwapStore,
    priceStore: MongoPriceStore,
    ownBalances: readonly Readonly<ITokenBalance>[],
    _ownSwaps: readonly Readonly<IRawSwap>[],
    tokenValues: readonly Readonly<IGalaSwapToken>[],
    options: { now?: Readonly<Date>; galaChainRouter?: GalaChainRouter | null } = {},
  ): ReturnType<ISwapStrategy['doTick']> {
    if (!this.config.active) {
      return {
        swapsToTerminate: [],
        swapsToCreate: [],
        swapsToAccept: [],
      };
    }

    const swapsToAccept = await getSwapsToAccept(
      reporter,
      selfUserId,
      this.config.tradeLimits,
      ownBalances,
      tokenValues,
      this.config.minimumBalances,
      async (givingTokenClass, receivingTokenClass) => {
        // Try chaincode first, fall back to REST API
        if (options.galaChainRouter) {
          try {
            const chaincodeSwaps = await options.galaChainRouter.getAvailableSwaps(
              givingTokenClass,
              receivingTokenClass,
            );
            if (chaincodeSwaps.length > 0) {
              // Convert chaincode format to IRawSwap format
              const swaps: IRawSwap[] = chaincodeSwaps.map((swap) => {
                const offeredFirst = swap.offered[0];
                const wantedFirst = swap.wanted[0];
                if (!offeredFirst || !wantedFirst) {
                  throw new Error('Invalid swap format: missing offered or wanted token');
                }
                return {
                  swapRequestId: swap.swapRequestId,
                  offered: [
                    {
                      quantity: offeredFirst.quantity,
                      tokenInstance: {
                        ...offeredFirst.tokenInstance,
                        instance: '0' as const,
                      },
                    },
                  ] as [Readonly<{ quantity: string; tokenInstance: Readonly<ITokenClassKey & { instance: '0' }> }>],
                  wanted: [
                    {
                      quantity: wantedFirst.quantity,
                      tokenInstance: {
                        ...wantedFirst.tokenInstance,
                        instance: '0' as const,
                      },
                    },
                  ] as [Readonly<{ quantity: string; tokenInstance: Readonly<ITokenClassKey & { instance: '0' }> }>],
                  created: swap.created,
                  expires: swap.expires,
                  uses: swap.uses,
                  usesSpent: swap.usesSpent,
                  offeredBy: swap.offeredBy,
                };
              });
              return swaps;
            }
          } catch (error) {
            _logger.warn(
              { error, givingTokenClass, receivingTokenClass },
              'Failed to get swaps via chaincode, trying REST API',
            );
          }
        }
        // Fall back to REST API
        return galaSwapApi.getAvailableSwaps(givingTokenClass, receivingTokenClass);
      },
      async (givingTokenClass, receivingTokenClass, since, goodnessRating) => {
        const quantityGiven = await acceptedSwapStore.getAmountAcceptedSince(
          stringifyTokenClass(givingTokenClass),
          stringifyTokenClass(receivingTokenClass),
          since,
          goodnessRating,
        );

        return quantityGiven;
      },
      async (tokenClass: ITokenClassKey, since: Date, until: Date) =>
        priceStore.getPriceChangePercent(tokenClass, since, until),
      options,
    );

    return {
      swapsToTerminate: [],
      swapsToCreate: [],
      swapsToAccept,
    };
  }
}
