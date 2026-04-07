// Schema bounded context
export { Schema } from './schema.entity';
export type { CreateSchemaProps } from './schema.entity';
export { FingerprintRule } from './fingerprint-rule.entity';
export type { CreateFingerprintRuleProps } from './fingerprint-rule.entity';
export { FieldDefinition } from './field-definition.entity';
export type { CreateFieldDefinitionProps, UpdateFieldDefinitionProps } from './field-definition.entity';
export type { ISchemaRepository } from './schema.repository';
export type { IFingerprintRuleRepository } from './fingerprint-rule.repository';
export type { IFieldDefinitionRepository } from './field-definition.repository';
export { FingerprintService } from './fingerprint.service';
export type { FingerprintInput, FingerprintResult, FingerprintRuleData } from './fingerprint.service';
