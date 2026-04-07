/**
 * Confidence-related types shared between frontend and backend.
 */

/** Confidence level thresholds */
export interface ConfidenceThresholds {
  /** Above this → auto-approve */
  readonly autoApprove: number;
  /** Below this → force review */
  readonly forceReview: number;
}

/** Per-field confidence */
export interface FieldConfidence {
  readonly fieldName: string;
  readonly confidence: number;
  readonly extractedValue: string | null;
}

/** Confidence calculation input */
export interface ConfidenceInput {
  readonly frontendHintSchemaId: string | null;
  readonly matchedSchemaId: string | null;
  readonly classificationMethod: 'frontend_hint' | 'fingerprint' | 'llm' | 'manual';
  readonly fingerprintScore: number;
  readonly fieldConfidences: Record<string, number>;
  readonly validationPassRate: number;
  readonly mappingCompleteness: number;
  readonly hintMatchesFingerprint: boolean;
}

/** Default confidence thresholds */
export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  autoApprove: 0.95,
  forceReview: 0.70,
} as const;
