/**
 * Fee Tier Constants for GalaSwap V3 Protocol
 * 
 * These match the official gSwap SDK fee tiers:
 * @see https://galachain.github.io/gswap-sdk/docs/tutorial-basics/trading
 * 
 * Fee tiers are represented as basis points (1 basis point = 0.01%):
 * - 500 = 0.05% (5 basis points)
 * - 3000 = 0.30% (30 basis points)  
 * - 10000 = 1.00% (100 basis points)
 */
export const FEE_TIER = {
  /** 0.05% fee tier (500 basis points) - Lowest fee, typically for stable pairs */
  PERCENT_00_05: 500,
  
  /** 0.30% fee tier (3000 basis points) - Medium fee, for most trading pairs */
  PERCENT_00_30: 3000,
  
  /** 1.00% fee tier (10000 basis points) - Highest fee, typically for volatile pairs */
  PERCENT_01_00: 10000,
} as const;

/**
 * Fee tier values as an array for iteration
 */
export const FEE_TIERS = [
  FEE_TIER.PERCENT_00_05,
  FEE_TIER.PERCENT_00_30,
  FEE_TIER.PERCENT_01_00,
] as const;

/**
 * Get fee tier percentage as a decimal (e.g., 0.01 for 1%)
 */
export function getFeeTierPercentage(feeTier: number): number {
  return feeTier / 10000;
}

/**
 * Get fee tier percentage as a string (e.g., "1.00%" for 10000)
 */
export function getFeeTierPercentageString(feeTier: number): string {
  return `${(feeTier / 100).toFixed(2)}%`;
}

