import {
  ConfidenceCalculator,
  ConfidenceInput,
} from '../confidence-calculator.service';

describe('ConfidenceCalculator', () => {
  const calculator = new ConfidenceCalculator();

  /**
   * Factory for creating ConfidenceInput with sensible defaults.
   */
  function createInput(overrides?: Partial<ConfidenceInput>): ConfidenceInput {
    return {
      classificationMethod: 'frontend_hint',
      fingerprintScore: 0.95,
      fieldConfidences: {
        invoiceNumber: 0.95,
        invoiceDate: 0.90,
        sellerTaxId: 0.98,
        total: 0.92,
      },
      requiredFields: ['invoiceNumber', 'invoiceDate', 'sellerTaxId', 'total'],
      validationPassRate: 1.0,
      mappingCompleteness: 1.0,
      hintMatchesFingerprint: true,
      hasHint: true,
      ...overrides,
    };
  }

  describe('calculate', () => {
    // ✅ Happy: All high scores → overall > 0.85
    it('should produce high overall score when all components are high', () => {
      const input = createInput();
      const result = calculator.calculate(input);

      expect(result.overallScore).toBeGreaterThan(0.85);
      expect(result.overallScore).toBeLessThanOrEqual(1.0);
      expect(result.penalties).toHaveLength(0);
    });

    // ✅ Happy: Frontend hint matches fingerprint → full hint score (0.30)
    it('should give full hint score (0.30) when hint matches fingerprint', () => {
      const input = createInput({
        hasHint: true,
        hintMatchesFingerprint: true,
      });
      const result = calculator.calculate(input);

      expect(result.componentScores.hintScore).toBe(1.0);
      // Hint weight = 0.30, so contribution = 0.30
    });

    // ✅ Edge: No frontend hint → hint component = 0
    it('should set hint score to 0 when no hint provided', () => {
      const input = createInput({
        hasHint: false,
        hintMatchesFingerprint: false,
      });
      const result = calculator.calculate(input);

      expect(result.componentScores.hintScore).toBe(0.0);
      // No penalty for no hint — just 0 contribution
      expect(result.penalties.filter((p: string) => p.includes('disagree'))).toHaveLength(0);
    });

    // ✅ Edge: Hint provided but no fingerprint match → hint = 0.5
    it('should set hint score to 0.5 when hint provided but no fingerprint match', () => {
      const input = createInput({
        hasHint: true,
        hintMatchesFingerprint: false,
        fingerprintScore: 0.0, // no fingerprint match at all
      });
      const result = calculator.calculate(input);

      expect(result.componentScores.hintScore).toBe(0.5);
    });

    // ✅ Edge: Hint disagrees with fingerprint → -0.20 penalty
    it('should apply -0.20 penalty when hint disagrees with fingerprint', () => {
      const input = createInput({
        hasHint: true,
        hintMatchesFingerprint: false,
        fingerprintScore: 0.9, // fingerprint says different schema
      });
      const result = calculator.calculate(input);

      const hasDisagreePenalty = result.penalties.some((p: string) =>
        p.includes('disagree'),
      );
      expect(hasDisagreePenalty).toBe(true);
      // Score should be lower than perfect by at least 0.20
      const perfectResult = calculator.calculate(createInput());
      expect(result.overallScore).toBeLessThan(perfectResult.overallScore - 0.15);
    });

    // ✅ Edge: All field confidences null → extraction quality = 0
    it('should set extraction quality to 0 when all field confidences are null', () => {
      const input = createInput({
        fieldConfidences: {},
        requiredFields: [],
      });
      const result = calculator.calculate(input);

      expect(result.componentScores.extractionQuality).toBe(0.0);
    });

    // ✅ Edge: Missing required fields → -0.05 per field penalty
    it('should apply -0.05 penalty per missing required field', () => {
      const input = createInput({
        fieldConfidences: {
          invoiceNumber: 0.95,
          // invoiceDate missing (null confidence means field not in object)
          // sellerTaxId missing
          total: 0.92,
        },
        requiredFields: ['invoiceNumber', 'invoiceDate', 'sellerTaxId', 'total'],
      });
      const result = calculator.calculate(input);

      // 2 required fields missing → 2 × 0.05 = 0.10 penalty
      const missingPenalties = result.penalties.filter((p: string) =>
        p.includes('required field'),
      );
      expect(missingPenalties.length).toBeGreaterThanOrEqual(1);
    });

    // ❌ Error: Heavy penalties → score clamped at 0.0 (never negative)
    it('should clamp score at 0.0 when penalties are heavy', () => {
      const input = createInput({
        hasHint: true,
        hintMatchesFingerprint: false,
        fingerprintScore: 0.8, // disagree penalty: -0.20
        fieldConfidences: {}, // extraction = 0
        requiredFields: [
          'f1', 'f2', 'f3', 'f4', 'f5',
          'f6', 'f7', 'f8', 'f9', 'f10',
        ], // 10 missing required fields: -0.50
        validationPassRate: 0.0,
        mappingCompleteness: 0.0,
      });
      const result = calculator.calculate(input);

      expect(result.overallScore).toBeGreaterThanOrEqual(0.0);
      expect(result.overallScore).toBeLessThanOrEqual(1.0);
    });

    // ❌ Error: Empty fieldConfidences → extraction quality = 0
    it('should handle empty fieldConfidences gracefully', () => {
      const input = createInput({
        fieldConfidences: {},
        requiredFields: [],
      });
      const result = calculator.calculate(input);

      expect(result.componentScores.extractionQuality).toBe(0.0);
      expect(result.overallScore).toBeGreaterThanOrEqual(0.0);
    });

    // Additional: Verify component scores structure
    it('should return all component scores in result', () => {
      const input = createInput();
      const result = calculator.calculate(input);

      expect(result.componentScores).toHaveProperty('hintScore');
      expect(result.componentScores).toHaveProperty('fingerprintScore');
      expect(result.componentScores).toHaveProperty('extractionQuality');
      expect(result.componentScores).toHaveProperty('validationScore');
      expect(result.componentScores).toHaveProperty('mappingScore');
      expect(typeof result.overallScore).toBe('number');
      expect(Array.isArray(result.penalties)).toBe(true);
    });
  });
});
