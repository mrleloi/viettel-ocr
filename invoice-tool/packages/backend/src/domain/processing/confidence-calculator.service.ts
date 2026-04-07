/**
 * Input data for confidence calculation.
 */
export interface ConfidenceInput {
  /** How the invoice was classified */
  readonly classificationMethod: 'frontend_hint' | 'fingerprint' | 'llm' | 'manual';
  /** Fingerprint match score from FingerprintService (0.0-1.0) */
  readonly fingerprintScore: number;
  /** Per-field extraction confidences: field_name → confidence (0.0-1.0) */
  readonly fieldConfidences: Record<string, number>;
  /** Names of fields that are required by the schema */
  readonly requiredFields: string[];
  /** Ratio of passed validation rules (0.0-1.0) */
  readonly validationPassRate: number;
  /** Ratio of mapped line items (0.0-1.0) */
  readonly mappingCompleteness: number;
  /** Whether the frontend hint matches the fingerprint result */
  readonly hintMatchesFingerprint: boolean;
  /** Whether a frontend hint was provided at all */
  readonly hasHint: boolean;
}

/**
 * Result of confidence calculation with component breakdown.
 */
export interface ConfidenceResult {
  /** Final composite score, clamped to [0.0, 1.0] */
  readonly overallScore: number;
  /** Individual component scores before weighting */
  readonly componentScores: {
    readonly hintScore: number;
    readonly fingerprintScore: number;
    readonly extractionQuality: number;
    readonly validationScore: number;
    readonly mappingScore: number;
  };
  /** Descriptions of applied penalties */
  readonly penalties: string[];
}

/** Weight for each component in the composite score */
const WEIGHTS = {
  hint: 0.30,
  fingerprint: 0.25,
  extraction: 0.25,
  validation: 0.10,
  mapping: 0.10,
} as const;

/** Penalty applied when frontend hint disagrees with fingerprint */
const HINT_DISAGREE_PENALTY = 0.20;

/** Penalty per required field with null/missing confidence */
const MISSING_REQUIRED_FIELD_PENALTY = 0.05;

/** Threshold for considering fingerprint as having a match */
const FINGERPRINT_MATCH_THRESHOLD = 0.1;

/**
 * ConfidenceCalculator — stateless domain service for composite confidence scoring.
 *
 * Calculates a weighted confidence score for processed invoices using
 * multiple factors: frontend hint match, fingerprint score, extraction quality,
 * validation pass rate, and mapping completeness.
 *
 * Penalties are applied for hint-fingerprint disagreements and missing required fields.
 */
export class ConfidenceCalculator {
  /**
   * Calculate composite confidence score for a processed invoice.
   * @param input Confidence calculation input data
   * @returns ConfidenceResult with overall score, component scores, and penalties
   */
  calculate(input: ConfidenceInput): ConfidenceResult {
    const penalties: string[] = [];

    // --- Component 1: Hint Score ---
    const hintScore = this.calculateHintScore(input);

    // --- Component 2: Fingerprint Score ---
    const fingerprintScore = input.fingerprintScore;

    // --- Component 3: Extraction Quality ---
    const extractionQuality = this.calculateExtractionQuality(input.fieldConfidences);

    // --- Component 4: Validation Score ---
    const validationScore = input.validationPassRate;

    // --- Component 5: Mapping Score ---
    const mappingScore = input.mappingCompleteness;

    // --- Weighted sum ---
    let score =
      hintScore * WEIGHTS.hint +
      fingerprintScore * WEIGHTS.fingerprint +
      extractionQuality * WEIGHTS.extraction +
      validationScore * WEIGHTS.validation +
      mappingScore * WEIGHTS.mapping;

    // --- Penalties ---

    // Hint disagrees with fingerprint
    if (
      input.hasHint &&
      !input.hintMatchesFingerprint &&
      input.fingerprintScore >= FINGERPRINT_MATCH_THRESHOLD
    ) {
      score -= HINT_DISAGREE_PENALTY;
      penalties.push(
        `Hint disagrees with fingerprint result (-${HINT_DISAGREE_PENALTY})`,
      );
    }

    // Missing required fields
    const missingRequiredCount = this.countMissingRequiredFields(
      input.requiredFields,
      input.fieldConfidences,
    );
    if (missingRequiredCount > 0) {
      const penalty = missingRequiredCount * MISSING_REQUIRED_FIELD_PENALTY;
      score -= penalty;
      penalties.push(
        `${missingRequiredCount} required field(s) missing (-${penalty.toFixed(2)})`,
      );
    }

    // --- Clamp to [0.0, 1.0] ---
    const overallScore = Math.max(0.0, Math.min(1.0, score));

    return {
      overallScore,
      componentScores: {
        hintScore,
        fingerprintScore,
        extractionQuality,
        validationScore,
        mappingScore,
      },
      penalties,
    };
  }

  /**
   * Calculate the hint component score.
   * @param input Confidence input
   * @returns 1.0 if hint matches fingerprint, 0.5 if hint but no fingerprint match, 0.0 if no hint
   */
  private calculateHintScore(input: ConfidenceInput): number {
    if (!input.hasHint) {
      return 0.0;
    }
    if (input.hintMatchesFingerprint) {
      return 1.0;
    }
    // Hint provided but fingerprint doesn't match
    return 0.5;
  }

  /**
   * Calculate average extraction quality from field confidences.
   * @param fieldConfidences Per-field confidence map
   * @returns Average confidence across all fields, or 0.0 if empty
   */
  private calculateExtractionQuality(
    fieldConfidences: Record<string, number>,
  ): number {
    const values = Object.values(fieldConfidences);
    if (values.length === 0) {
      return 0.0;
    }
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Count required fields that are missing from field confidences.
   * @param requiredFields List of required field names
   * @param fieldConfidences Per-field confidence map
   * @returns Number of missing required fields
   */
  private countMissingRequiredFields(
    requiredFields: string[],
    fieldConfidences: Record<string, number>,
  ): number {
    let missing = 0;
    for (const field of requiredFields) {
      if (!(field in fieldConfidences)) {
        missing++;
      }
    }
    return missing;
  }
}
