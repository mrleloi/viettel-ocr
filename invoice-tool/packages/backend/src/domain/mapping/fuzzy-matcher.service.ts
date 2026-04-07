/**
 * Data representation of a Viettel product for fuzzy matching.
 */
export interface ProductData {
  /** Product ID */
  readonly id: string;
  /** Product code (e.g., "SP001") */
  readonly productCode: string;
  /** Product name */
  readonly productName: string;
  /** Brand name, or null if unknown */
  readonly brand: string | null;
}

/**
 * Result of a fuzzy match for a single product.
 */
export interface FuzzyMatchResult {
  /** Matched product ID */
  readonly productId: string;
  /** Matched product code */
  readonly productCode: string;
  /** Matched product name */
  readonly productName: string;
  /** Match score (0.0 - 1.0) */
  readonly score: number;
}

/**
 * Options for fuzzy matching.
 */
export interface FuzzyMatchOptions {
  /** Maximum number of results to return (default: 5) */
  readonly topN?: number;
  /** Minimum score threshold (default: 0.3) */
  readonly threshold?: number;
}

/** Default number of results to return */
const DEFAULT_TOP_N = 5;

/** Default minimum score threshold */
const DEFAULT_THRESHOLD = 0.3;

/** Weights for the composite score */
const SCORE_WEIGHTS = {
  jaccard: 0.5,
  lcs: 0.3,
  brand: 0.2,
} as const;

/** Brand bonus value when brand token matches */
const BRAND_BONUS = 0.15;

/**
 * Vietnamese diacritics mapping for normalization.
 * Maps accented characters to their base Latin equivalents.
 */
const VIETNAMESE_DIACRITICS: Record<string, string> = {
  'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
  'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
  'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
  'đ': 'd',
  'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
  'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
  'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
  'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
  'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
  'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
  'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
  'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
  'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
};

/**
 * FuzzyMatcher — stateless domain service for fuzzy product name matching.
 *
 * Finds best-matching Viettel products for a given partner product name
 * using token-based similarity (Jaccard + LCS + brand bonus).
 * Enables auto-mapping and suggestions in the mapping workflow.
 */
export class FuzzyMatcher {
  /**
   * Find best-matching products for a given partner product name.
   * @param partnerProductName The partner's product name to match
   * @param products List of Viettel products to match against
   * @param options Optional matching parameters (topN, threshold)
   * @returns Array of FuzzyMatchResult sorted descending by score
   */
  match(
    partnerProductName: string,
    products: ProductData[],
    options?: FuzzyMatchOptions,
  ): FuzzyMatchResult[] {
    const topN = options?.topN ?? DEFAULT_TOP_N;
    const threshold = options?.threshold ?? DEFAULT_THRESHOLD;

    // Early exit for empty inputs
    if (!partnerProductName.trim() || products.length === 0) {
      return [];
    }

    const normalizedQuery = this.normalize(partnerProductName);
    const queryTokens = this.tokenize(normalizedQuery);

    if (queryTokens.length === 0) {
      return [];
    }

    const scored: FuzzyMatchResult[] = [];

    for (const product of products) {
      const normalizedProductName = this.normalize(product.productName);
      const productTokens = this.tokenize(normalizedProductName);

      if (productTokens.length === 0) {
        continue;
      }

      // Calculate component scores
      const jaccardScore = this.jaccardSimilarity(queryTokens, productTokens);
      const lcsRatio = this.lcsRatio(normalizedQuery, normalizedProductName);
      const brandBonus = this.calculateBrandBonus(
        queryTokens,
        product.brand,
      );

      // Composite score
      const score =
        SCORE_WEIGHTS.jaccard * jaccardScore +
        SCORE_WEIGHTS.lcs * lcsRatio +
        SCORE_WEIGHTS.brand * (brandBonus > 0 ? 1.0 : 0.0);

      if (score >= threshold) {
        scored.push({
          productId: product.id,
          productCode: product.productCode,
          productName: product.productName,
          score: Math.min(1.0, score),
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // Limit to topN
    return scored.slice(0, topN);
  }

  /**
   * Normalize a string: lowercase, strip Vietnamese diacritics.
   * @param text Input text
   * @returns Normalized text
   */
  private normalize(text: string): string {
    let result = text.toLowerCase();
    for (const [accented, base] of Object.entries(VIETNAMESE_DIACRITICS)) {
      result = result.split(accented).join(base);
    }
    return result;
  }

  /**
   * Tokenize a string by splitting on spaces and special characters.
   * @param text Normalized text
   * @returns Array of tokens (non-empty)
   */
  private tokenize(text: string): string[] {
    return text
      .split(/[\s,./\\-]+/)
      .filter((token) => token.length > 0);
  }

  /**
   * Calculate Jaccard similarity between two token sets.
   * @param tokensA First token set
   * @param tokensB Second token set
   * @returns Jaccard similarity coefficient (0.0 - 1.0)
   */
  private jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    let intersectionSize = 0;
    for (const token of setA) {
      if (setB.has(token)) {
        intersectionSize++;
      }
    }

    const unionSize = new Set([...tokensA, ...tokensB]).size;

    if (unionSize === 0) {
      return 0.0;
    }

    return intersectionSize / unionSize;
  }

  /**
   * Calculate LCS (Longest Common Subsequence) ratio.
   * @param a First string
   * @param b Second string
   * @returns LCS length / max(a.length, b.length), or 0.0 if either is empty
   */
  private lcsRatio(a: string, b: string): number {
    if (a.length === 0 || b.length === 0) {
      return 0.0;
    }

    const lcsLength = this.lcsLength(a, b);
    return lcsLength / Math.max(a.length, b.length);
  }

  /**
   * Calculate the length of the Longest Common Subsequence using DP.
   * Uses space-optimized rolling array approach.
   * @param a First string
   * @param b Second string
   * @returns Length of LCS
   */
  private lcsLength(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    // Use two rows to save memory
    let prev = new Array<number>(n + 1).fill(0);
    let curr = new Array<number>(n + 1).fill(0);

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          curr[j] = prev[j - 1] + 1;
        } else {
          curr[j] = Math.max(prev[j], curr[j - 1]);
        }
      }
      // Swap rows
      [prev, curr] = [curr, prev];
      curr.fill(0);
    }

    return prev[n];
  }

  /**
   * Calculate brand bonus based on whether brand tokens appear in query.
   * @param queryTokens Tokenized query
   * @param brand Product brand name, or null
   * @returns Brand bonus value (0.15 if match, 0 otherwise)
   */
  private calculateBrandBonus(
    queryTokens: string[],
    brand: string | null,
  ): number {
    if (!brand) {
      return 0.0;
    }

    const normalizedBrand = this.normalize(brand);
    const brandTokens = this.tokenize(normalizedBrand);

    for (const brandToken of brandTokens) {
      if (queryTokens.includes(brandToken)) {
        return BRAND_BONUS;
      }
    }

    return 0.0;
  }
}
