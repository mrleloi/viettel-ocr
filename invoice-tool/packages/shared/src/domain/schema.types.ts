/**
 * Schema domain types shared between frontend and backend.
 */

/** Schema status */
export type SchemaStatus = 'active' | 'inactive' | 'draft' | 'archived';

/** Fingerprint rule type */
export type FingerprintRuleType = 'mst_exact' | 'keyword' | 'symbol_regex' | 'custom';

/** Field data type for schema field definitions */
export type FieldDataType = 'string' | 'integer' | 'number' | 'date' | 'boolean';

/** Fingerprint rule properties */
export interface FingerprintRuleProps {
  readonly id: string;
  readonly schemaId: string;
  readonly ruleType: FingerprintRuleType;
  readonly pattern: string;
  readonly priority: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
}

/** Schema field definition properties */
export interface FieldDefinitionProps {
  readonly id: string;
  readonly schemaId: string;
  readonly fieldName: string;
  readonly displayName: string;
  readonly dataType: FieldDataType;
  readonly isRequired: boolean;
  readonly validationRules: string | null;
  readonly extractionHint: string | null;
  readonly outputKey: string | null;
  readonly sortOrder: number;
}

/** Core schema properties */
export interface SchemaProps {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly nccName: string;
  readonly nccTaxId: string;
  readonly status: SchemaStatus;
  readonly promptTemplate: string | null;
  readonly behaviorConfig: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
