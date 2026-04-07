import { DomainError } from '../shared/domain-error';
import { generateId } from '../shared/identifier';
import type { FingerprintRuleProps, FingerprintRuleType } from '@invoice-tool/shared';

const VALID_RULE_TYPES: FingerprintRuleType[] = ['mst_exact', 'keyword', 'symbol_regex', 'custom'];

/** Props required to create a new FingerprintRule */
export interface CreateFingerprintRuleProps {
  readonly id?: string;
  readonly schemaId: string;
  readonly ruleType: string;
  readonly pattern: string;
  readonly priority: number;
}

/**
 * FingerprintRule entity — defines a pattern-matching rule for invoice classification.
 * Used by the FingerprintService to classify invoices to schemas without AI.
 */
export class FingerprintRule {
  private props: FingerprintRuleProps;

  private constructor(props: FingerprintRuleProps) {
    this.props = props;
  }

  /**
   * Create a new FingerprintRule.
   * @param input Required fields for a new rule
   * @returns A new FingerprintRule instance
   * @throws DomainError if required fields are missing or invalid
   */
  static create(input: CreateFingerprintRuleProps): FingerprintRule {
    if (!input.schemaId) {
      throw new DomainError('FingerprintRule schema ID is required');
    }
    if (!input.pattern) {
      throw new DomainError('FingerprintRule pattern is required');
    }
    if (!VALID_RULE_TYPES.includes(input.ruleType as FingerprintRuleType)) {
      throw new DomainError(`Invalid rule type: "${input.ruleType}". Must be one of: ${VALID_RULE_TYPES.join(', ')}`);
    }
    if (input.priority < 0) {
      throw new DomainError('FingerprintRule priority cannot be negative');
    }

    return new FingerprintRule({
      id: input.id ?? generateId(),
      schemaId: input.schemaId,
      ruleType: input.ruleType as FingerprintRuleType,
      pattern: input.pattern,
      priority: input.priority,
      isActive: true,
      createdAt: new Date(),
    });
  }

  /**
   * Reconstitute a FingerprintRule from stored data (skips validation).
   * @param props All rule properties from persistence
   * @returns A FingerprintRule instance
   */
  static reconstitute(props: FingerprintRuleProps): FingerprintRule {
    return new FingerprintRule({ ...props });
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get schemaId(): string { return this.props.schemaId; }
  get ruleType(): FingerprintRuleType { return this.props.ruleType; }
  get pattern(): string { return this.props.pattern; }
  get priority(): number { return this.props.priority; }
  get isActive(): boolean { return this.props.isActive; }
  get createdAt(): Date { return this.props.createdAt; }

  /**
   * Deactivate this rule.
   */
  deactivate(): void {
    this.props = { ...this.props, isActive: false };
  }

  /**
   * Activate this rule.
   */
  activate(): void {
    this.props = { ...this.props, isActive: true };
  }

  /**
   * Return a plain object representation for persistence.
   * @returns FingerprintRuleProps
   */
  toProps(): FingerprintRuleProps {
    return { ...this.props };
  }
}
