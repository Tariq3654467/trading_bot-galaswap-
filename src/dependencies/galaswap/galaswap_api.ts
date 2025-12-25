import crypto from 'crypto';
import { ethers } from 'ethers';
import pRetry from 'p-retry';
import util from 'util';
import { ILogger, ITokenClassKey } from '../../types/types.js';
import { GalaChainRouter } from '../onchain/galachain_router.js';
import { signObject } from './galachain_signing.js';
import {
  HttpDelegate,
  IGalaSwapApi,
  IRawSwap,
  acceptSwapResponseSchema,
  availableSwapsResponseSchema,
  balanceResponseSchema,
  createSwapResponseSchema,
  swapsByUserResponseSchema,
  tokenResponseSchema,
} from './types.js';

const sleep = util.promisify(setTimeout);

export class GalaSwapErrorResponse extends Error {
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

    const responseBody = GalaSwapErrorResponse.parseJsonOrUndefined(responseText);
    this.errorCode = responseBody?.error?.ErrorKey ?? responseBody?.error ?? 'UNKNOWN_ERROR';
  }
}

export class GalaSwapApi implements IGalaSwapApi {
  private readonly signerPublicKey: string;
  private readonly galaChainRouter: GalaChainRouter | null;

  constructor(
    private readonly baseUrl: string,
    private readonly walletAddress: string,
    private readonly privateKey: string,
    private readonly fetch: HttpDelegate,
    private readonly logger: ILogger,
    private readonly options: { maxRetries?: number; requestTimeoutMs?: number; connectTimeoutMs?: number; galaChainRouter?: GalaChainRouter | null } = {},
  ) {
    this.galaChainRouter = options.galaChainRouter ?? null;
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
            uniqueKey: `galaswap-operation-${crypto.randomUUID()}`,
          },
          this.privateKey,
        )
      : options.body;

    const uri = `${this.baseUrl}${path}`;

    const requestTimeoutMs = this.options.requestTimeoutMs ?? 30000;
    const connectTimeoutMs = this.options.connectTimeoutMs ?? 15000;

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await this.fetch(uri, {
        method,
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal,
      } as RequestInit);

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new GalaSwapErrorResponse(uri, response.status, await response.text());
      }

      return response.json() as unknown;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Re-throw GalaSwapErrorResponse as-is
      if (error instanceof GalaSwapErrorResponse) {
        throw error;
      }
      
      // Provide better error messages for network errors
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw new Error(`GalaSwap API request timeout after ${requestTimeoutMs}ms: ${uri}`);
        }
        if (error.message.includes('EAI_AGAIN') || error.message.includes('getaddrinfo')) {
          throw new Error(`GalaSwap API DNS resolution failed: ${uri}. Check network connectivity.`);
        }
        if (error.message.includes('ECONNREFUSED') || error.message.includes('Connect Timeout')) {
          throw new Error(`GalaSwap API connection failed: ${uri}. Server may be unreachable.`);
        }
      }
      
      throw error;
    }
  }

  async getTokens(searchPrefix?: string) {
    // Try v2 endpoint first (new structure), then fallback to v1
    const pathsToTry = searchPrefix
      ? [`/v2/tokens?searchprefix=${searchPrefix}`, `/v1/tokens?searchprefix=${searchPrefix}`]
      : ['/v2/tokens', '/v1/tokens'];

    for (const path of pathsToTry) {
      try {
        const tokenResponse = await this.retry(() => this.fetchJson(path, 'GET', false));
        return tokenResponseSchema.parse(tokenResponse);
      } catch (err) {
        // If this is the last path to try, handle the error
        if (path === pathsToTry[pathsToTry.length - 1]) {
          if (err instanceof GalaSwapErrorResponse && err.status === 404) {
            this.logger.warn({
              message: `All token endpoints (${pathsToTry.join(', ')}) returned 404. Returning empty tokens list.`,
              uri: err.uri,
            });
            return { tokens: [] };
          }
          throw err;
        }
        // Otherwise, continue to next path
        if (err instanceof GalaSwapErrorResponse && err.status === 404) {
          this.logger.warn({
            message: `Token endpoint ${path} returned 404, trying next path.`,
            uri: err.uri,
          });
          continue;
        }
        // Non-404 error, throw immediately
        throw err;
      }
    }

    // Should never reach here, but TypeScript needs it
    return { tokens: [] };
  }

  async getRawBalances(walletAddress: string) {
    // Try chaincode first (preferred method), fall back to REST API
    if (this.galaChainRouter) {
      try {
        const balances = await this.galaChainRouter.getBalances(walletAddress);
        if (balances.length > 0) {
          this.logger.info(
            { walletAddress, balanceCount: balances.length },
            'Retrieved balances via GalaChain chaincode',
          );
          return balances;
        }
        // If chaincode returns empty, fall through to REST API
        this.logger.warn(
          { walletAddress },
          'Chaincode returned empty balances, falling back to REST API',
        );
      } catch (error) {
        this.logger.warn(
          { error, walletAddress },
          'Failed to get balances via chaincode, falling back to REST API',
        );
      }
    }

    // Fallback to REST API (deprecated endpoints)
    // Updated 2025 path: /v1/token-contract/{METHOD}
    // Try new endpoint first: FetchBalancesWithMetadata
    try {
      const result = await this.retry(() =>
        this.fetchJson(`/v1/token-contract/FetchBalancesWithMetadata`, 'POST', false, {
          body: { owner: walletAddress },
        }),
      );

      const parsedResult = balanceResponseSchema.parse(result);
      return parsedResult.Data;
    } catch (err) {
      // Fallback to old path structure for backward compatibility
      if (err instanceof GalaSwapErrorResponse && err.status === 404) {
        this.logger.warn({
          message: 'New endpoint /v1/token-contract/FetchBalancesWithMetadata returned 404, trying old path structure.',
          uri: err.uri,
        });
        try {
          const result = await this.retry(() =>
            this.fetchJson(`/galachain/api/asset/token-contract/FetchBalancesWithMetadata`, 'POST', false, {
              body: { owner: walletAddress },
            }),
          );
          const parsedResult = balanceResponseSchema.parse(result);
          return parsedResult.Data;
        } catch (fallbackErr) {
          // Try deprecated endpoint as last resort
          if (fallbackErr instanceof GalaSwapErrorResponse && fallbackErr.status === 404) {
            try {
              const result = await this.retry(() =>
                this.fetchJson(`/galachain/api/asset/token-contract/FetchBalances`, 'POST', false, {
                  body: { owner: walletAddress },
                }),
              );
              const parsedResult = balanceResponseSchema.parse(result);
              return parsedResult.Data;
            } catch (finalErr) {
              // All endpoints failed - return empty balances
              if (finalErr instanceof GalaSwapErrorResponse && finalErr.status === 404) {
                this.logger.warn({
                  message: 'All balance endpoints returned 404. Returning empty balances.',
                });
                return [];
              }
              throw finalErr;
            }
          }
          throw fallbackErr;
        }
      }
      throw err;
    }
  }

  async getAvailableSwaps(
    offeredTokenClass: Readonly<ITokenClassKey>,
    wantedTokenClass: Readonly<ITokenClassKey>,
  ) {
    // Try chaincode first (preferred method), fall back to REST API
    if (this.galaChainRouter) {
      try {
        const chaincodeSwaps = await this.galaChainRouter.getAvailableSwaps(offeredTokenClass, wantedTokenClass);
        if (chaincodeSwaps.length > 0) {
          // Convert chaincode format to IRawSwap format
          const swaps: IRawSwap[] = chaincodeSwaps.map((swap) => ({
            swapRequestId: swap.swapRequestId,
            offered: swap.offered.map((o) => ({
              quantity: o.quantity,
              tokenInstance: {
                ...o.tokenInstance,
                instance: '0' as const,
              },
            })) as [Readonly<{ quantity: string; tokenInstance: Readonly<ITokenClassKey & { instance: '0' }> }>],
            wanted: swap.wanted.map((w) => ({
              quantity: w.quantity,
              tokenInstance: {
                ...w.tokenInstance,
                instance: '0' as const,
              },
            })) as [Readonly<{ quantity: string; tokenInstance: Readonly<ITokenClassKey & { instance: '0' }> }>],
            created: swap.created,
            expires: swap.expires,
            uses: swap.uses,
            usesSpent: swap.usesSpent,
            offeredBy: swap.offeredBy,
          }));
          this.logger.info(
            { offeredTokenClass, wantedTokenClass, swapCount: swaps.length },
            'Retrieved swaps via GalaChain chaincode',
          );
          return swaps;
        }
        // If chaincode returns empty, fall through to REST API
        this.logger.warn(
          { offeredTokenClass, wantedTokenClass },
          'Chaincode returned empty swaps, falling back to REST API',
        );
      } catch (error) {
        this.logger.warn(
          { error, offeredTokenClass, wantedTokenClass },
          'Failed to get swaps via chaincode, falling back to REST API',
        );
      }
    }

    // Fallback to REST API (deprecated endpoints)
    try {
      const result = await this.retry(() =>
        this.fetchJson(`/v1/FetchAvailableTokenSwaps`, 'POST', false, {
          body: { offeredTokenClass, wantedTokenClass },
        }),
      );

      const parsedResult = availableSwapsResponseSchema.parse(result);
      return parsedResult.results;
    } catch (err) {
      // Gracefully handle deprecated endpoint (404) - return empty swaps list
      if (err instanceof GalaSwapErrorResponse && err.status === 404) {
        this.logger.warn({
          message: 'GalaSwap v1 endpoint /v1/FetchAvailableTokenSwaps returned 404. This endpoint is deprecated. Returning empty swaps list.',
          uri: err.uri,
        });
        return [];
      }
      throw err;
    }
  }

  async acceptSwap(swapRequestId: string, uses: string) {
    try {
      const result = await this.retry(() =>
        this.fetchJson(`/v1/BatchFillTokenSwap`, 'POST', true, {
          body: {
            swapDtos: [
              {
                swapRequestId,
                uses,
              },
            ],
          },
        }),
      );

      acceptSwapResponseSchema.parse(result);

      return { status: 'accepted' as const };
    } catch (err) {
      if (err instanceof GalaSwapErrorResponse && err.errorCode === 'SWAP_ALREADY_USED') {
        return { status: 'already_accepted' as const };
      }

      throw err;
    }
  }

  async terminateSwap(swapRequestId: string) {
    await this.retry(() =>
      this.fetchJson(`/v1/TerminateTokenSwap`, 'POST', true, {
        body: { swapRequestId },
      }),
    );
  }

  async createSwap(newSwap: Readonly<Pick<IRawSwap, 'offered' | 'wanted'>>) {
    const result = await this.fetchJson(`/v1/RequestTokenSwap`, 'POST', true, {
      body: newSwap,
    });

    const parsedResult = createSwapResponseSchema.parse(result);
    return parsedResult.Data;
  }

  async getSwapsByWalletAddress(walletAddress: string) {
    // Updated 2025 path: /v1/token-contract/{METHOD}
    // Try new endpoint first: FetchTokenSwapsByUser with new path
    try {
      let nextPageBookMark: string | undefined = undefined;
      const results: IRawSwap[] = [];

      do {
        const requestBody: { user: string; bookmark?: string } = nextPageBookMark
          ? { user: walletAddress, bookmark: nextPageBookMark }
          : { user: walletAddress };

        const result: unknown = await this.retry(() =>
          this.fetchJson(
            `/v1/token-contract/FetchTokenSwapsByUser`,
            'POST',
            false,
            {
              body: requestBody,
            },
          ),
        );

        const parsedResult = swapsByUserResponseSchema.parse(result);
        nextPageBookMark = parsedResult.Data.nextPageBookMark || undefined;
        results.push(...parsedResult.Data.results);
      } while (nextPageBookMark);

      return results;
    } catch (err) {
      // If 404, return empty array immediately (silence log spam for deprecated endpoints)
      if (err instanceof GalaSwapErrorResponse && err.status === 404) {
        return [];
      }
      throw err;
    }
  }

  private retry<TResponseType>(fn: () => Promise<TResponseType>) {
    return pRetry(fn, {
      retries: this.options.maxRetries ?? 5,
      onFailedAttempt: async (err: unknown) => {
        this.logger.warn({
          message: 'GalaSwap API failed request',
          err,
        });

        await sleep(250);
      },
      shouldRetry: async (err: unknown): Promise<boolean> => {
        // Don't retry on network/DNS errors - these are usually infrastructure issues
        if (err instanceof Error) {
          if (
            err.message.includes('EAI_AGAIN') ||
            err.message.includes('getaddrinfo') ||
            err.message.includes('ECONNREFUSED') ||
            err.message.includes('DNS resolution failed')
          ) {
            this.logger.error({
              message: 'GalaSwap API network error - not retrying',
              err: err.message,
            });
            return false;
          }
        }

        // Don't retry on 404 errors - these indicate deprecated endpoints
        if (err instanceof GalaSwapErrorResponse && err.status === 404) {
          this.logger.warn({
            message: 'GalaSwap API endpoint returned 404 (deprecated endpoint). Not retrying.',
            uri: err.uri,
          });
          return false;
        }

        if (
          err instanceof GalaSwapErrorResponse &&
          err.status < 500 &&
          err.status !== 400 &&
          err.status !== 429
        ) {
          // Non-retriable error
          return false;
        }

        if (err instanceof GalaSwapErrorResponse && err.status === 429) {
          this.logger.warn({
            message: 'GalaSwap API rate limited',
            err: err.responseText,
          });

          await sleep(10_000);
        }

        // Retry timeout errors (may be transient)
        if (err instanceof Error && err.message.includes('timeout')) {
          this.logger.warn({
            message: 'GalaSwap API timeout - will retry',
            err: err.message,
          });
          await sleep(2_000); // Wait longer before retrying timeouts
          return true;
        }

        return true;
      },
    });
  }
}
