/**
 * Input data for fingerprint classification.
 */
export interface FingerprintInput {
  /** Raw OCR text from the invoice */
  readonly ocrText: string;
  /** Extracted seller tax ID (if available) */
  readonly sellerTaxId?: string;
  /** Extracted invoice symbol (if available) */
  readonly invoiceSymbol?: string;
}

/**
 * Result of fingerprint classification.
 */
export interface FingerprintResult {
  /** Whether any schema matched */
  readonly matched: boolean;
  /** Matched schema ID, null if no match */
  readonly schemaId: string | null;
  /** Match confidence score (0.0 - 1.0) */
  readonly score: number;
  /** IDs of rules that matched */
  readonly matchedRules: string[];
  /** Classification method used for the best match */
  readonly method: 'mst_exact' | 'keyword' | 'symbol_regex' | 'custom' | null;
}

/**
 * Fingerprint rule data — plain data representation for the service.
 * Decoupled from the FingerprintRule entity to keep the service stateless.
 */
export interface FingerprintRuleData {
  /** Rule ID */
  readonly id: string;
  /** Schema this rule belongs to */
  readonly schemaId: string;
  /** Type of matching rule */
  readonly ruleType: 'mst_exact' | 'mst_contains' | 'keyword_contains' | 'symbol_regex' | 'custom_regex';
  /** Which field to match against */
  readonly ruleField: 'full_text' | 'seller_tax_id' | 'invoice_symbol' | 'header';
  /** Pattern or value to match */
  readonly ruleValue: string;
  /** Priority (lower = higher priority) */
  readonly priority: number;
}

/** Score assigned to each rule type */
const RULE_TYPE_SCORES: Record<FingerprintRuleData['ruleType'], number> = {
  mst_exact: 1.0,
  mst_contains: 0.9,
  symbol_regex: 0.8,
  keyword_contains: 0.7,
  custom_regex: 0.6,
};

/** Map rule types to classification methods */
const RULE_TYPE_TO_METHOD: Record<FingerprintRuleData['ruleType'], FingerprintResult['method']> = {
  mst_exact: 'mst_exact',
  mst_contains: 'mst_exact',
  keyword_contains: 'keyword',
  symbol_regex: 'symbol_regex',
  custom_regex: 'custom',
};

/** Internal per-schema match accumulator */
interface SchemaMatch {
  schemaId: string;
  bestScore: number;
  bestPriority: number;
  bestMethod: FingerprintResult['method'];
  matchedRuleIds: string[];
}

/**
 * FingerprintService — stateless domain service for invoice classification.
 *
 * Classifies invoices by matching OCR text and extracted fields against
 * fingerprint rules. This is the zero-AI-cost first step before LLM fallback.
 *
 * Rules are evaluated in priority order. Multiple rules can match; the service
 * selects the schema with the highest match score, breaking ties by priority.
 */
export class FingerprintService {
  /**
   * Classify an invoice by matching against fingerprint rules.
   * @param input OCR text and extracted fields
   * @param rules Active fingerprint rules to evaluate
   * @returns Classification result with matched schema and confidence
   */
  classify(input: FingerprintInput, rules: FingerprintRuleData[]): FingerprintResult {
    if (rules.length === 0) {
      return this.noMatch();
    }

    // Sort rules by priority (lower = higher priority)
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    // Accumulate matches per schema
    const schemaMatches = new Map<string, SchemaMatch>();

    for (const rule of sortedRules) {
      const matched = this.evaluateRule(rule, input);
      if (!matched) continue;

      const score = RULE_TYPE_SCORES[rule.ruleType];
      const existing = schemaMatches.get(rule.schemaId);

      if (existing) {
        existing.matchedRuleIds.push(rule.id);
        // Update best score/method if this rule scores higher
        if (score > existing.bestScore || (score === existing.bestScore && rule.priority < existing.bestPriority)) {
          existing.bestScore = score;
          existing.bestPriority = rule.priority;
          existing.bestMethod = RULE_TYPE_TO_METHOD[rule.ruleType];
        }
      } else {
        schemaMatches.set(rule.schemaId, {
          schemaId: rule.schemaId,
          bestScore: score,
          bestPriority: rule.priority,
          bestMethod: RULE_TYPE_TO_METHOD[rule.ruleType],
          matchedRuleIds: [rule.id],
        });
      }
    }

    if (schemaMatches.size === 0) {
      return this.noMatch();
    }

    // Select the schema with the highest score, tie-break by priority
    let best: SchemaMatch | null = null;
    for (const match of schemaMatches.values()) {
      if (
        !best ||
        match.bestScore > best.bestScore ||
        (match.bestScore === best.bestScore && match.bestPriority < best.bestPriority)
      ) {
        best = match;
      }
    }

    return {
      matched: true,
      schemaId: best!.schemaId,
      score: best!.bestScore,
      matchedRules: best!.matchedRuleIds,
      method: best!.bestMethod,
    };
  }

  /**
   * Evaluate a single rule against the input.
   * @param rule Rule to evaluate
   * @param input Input data
   * @returns Whether the rule matches
   */
  private evaluateRule(rule: FingerprintRuleData, input: FingerprintInput): boolean {
    switch (rule.ruleType) {
      case 'mst_exact':
        return this.evaluateMstExact(rule.ruleValue, input.sellerTaxId);
      case 'mst_contains':
        return this.evaluateMstContains(rule.ruleValue, input.ocrText);
      case 'keyword_contains':
        return this.evaluateKeywordContains(rule.ruleValue, input.ocrText);
      case 'symbol_regex':
        return this.evaluateRegex(rule.ruleValue, input.invoiceSymbol ?? '');
      case 'custom_regex':
        return this.evaluateRegex(rule.ruleValue, input.ocrText);
      default:
        return false;
    }
  }

  /**
   * MST exact match — compare cleaned tax IDs.
   * @param ruleValue Expected tax ID
   * @param sellerTaxId Extracted seller tax ID
   * @returns True if tax IDs match after normalization
   */
  private evaluateMstExact(ruleValue: string, sellerTaxId: string | undefined): boolean {
    if (!sellerTaxId) return false;
    const cleanRule = ruleValue.replace(/[\s-]/g, '');
    const cleanInput = sellerTaxId.replace(/[\s-]/g, '');
    return cleanRule === cleanInput;
  }

  /**
   * MST contains — check if tax ID appears in OCR text.
   * @param ruleValue Tax ID to search for
   * @param ocrText Full OCR text
   * @returns True if OCR text contains the tax ID
   */
  private evaluateMstContains(ruleValue: string, ocrText: string): boolean {
    return ocrText.includes(ruleValue);
  }

  /**
   * Keyword contains — case-insensitive keyword search.
   * @param ruleValue Keyword to search for
   * @param ocrText Full OCR text
   * @returns True if OCR text contains the keyword (case-insensitive)
   */
  private evaluateKeywordContains(ruleValue: string, ocrText: string): boolean {
    return ocrText.toLowerCase().includes(ruleValue.toLowerCase());
  }

  /**
   * Regex evaluation with error handling for invalid patterns.
   * @param pattern Regex pattern string
   * @param text Text to test against
   * @returns True if pattern matches, false if invalid pattern or no match
   */
  private evaluateRegex(pattern: string, text: string): boolean {
    try {
      return new RegExp(pattern).test(text);
    } catch {
      // Invalid regex pattern — fail silently
      return false;
    }
  }

  /**
   * Return default no-match result.
   * @returns FingerprintResult with matched=false
   */
  private noMatch(): FingerprintResult {
    return {
      matched: false,
      schemaId: null,
      score: 0,
      matchedRules: [],
      method: null,
    };
  }
}
