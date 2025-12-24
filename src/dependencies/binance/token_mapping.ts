import { ITokenClassKey } from '../../types/types.js';

export interface ITokenMapping {
  galaToken: ITokenClassKey;
  binanceSymbol: string;
  quoteCurrency?: string | undefined; // Default is USDT
}

export interface IBinanceTokenMappingConfig {
  mappings: readonly ITokenMapping[];
  defaultQuoteCurrency?: string; // Default is USDT
  enabled: boolean;
}

/**
 * Maps Gala token class to Binance symbol
 */
export function getBinanceSymbol(
  tokenClass: ITokenClassKey,
  mappingConfig: IBinanceTokenMappingConfig,
): string | null {
  if (!mappingConfig.enabled) {
    return null;
  }

  const mapping = mappingConfig.mappings.find(
    (m) =>
      m.galaToken.collection === tokenClass.collection &&
      m.galaToken.category === tokenClass.category &&
      m.galaToken.type === tokenClass.type &&
      m.galaToken.additionalKey === tokenClass.additionalKey,
  );

  if (!mapping) {
    return null;
  }

  return mapping.binanceSymbol;
}

/**
 * Gets all Binance symbols from the mapping config
 */
export function getAllBinanceSymbols(
  mappingConfig: IBinanceTokenMappingConfig,
): readonly string[] {
  if (!mappingConfig.enabled) {
    return [];
  }

  return mappingConfig.mappings.map((m) => m.binanceSymbol);
}

