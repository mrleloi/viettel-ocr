import { CreateSchemaUseCase } from '../create-schema.use-case';
import type { ISchemaRepository } from '../../../domain/schema/schema.repository';
import type { IFingerprintRuleRepository } from '../../../domain/schema/fingerprint-rule.repository';
import type { IFieldDefinitionRepository } from '../../../domain/schema/field-definition.repository';
import { Schema } from '../../../domain/schema/schema.entity';

describe('CreateSchemaUseCase', () => {
  let sut: CreateSchemaUseCase;
  let schemaRepo: jest.Mocked<ISchemaRepository>;
  let ruleRepo: jest.Mocked<IFingerprintRuleRepository>;
  let fieldRepo: jest.Mocked<IFieldDefinitionRepository>;

  beforeEach(() => {
    schemaRepo = {
      findById: jest.fn(),
      findActive: jest.fn(),
    findAll: jest.fn(),
      findByNccTaxId: jest.fn(),
      save: jest.fn(),
    };
    ruleRepo = {
      findBySchemaId: jest.fn(),
      findAllActive: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    fieldRepo = {
      findBySchemaId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    sut = new CreateSchemaUseCase(schemaRepo, ruleRepo, fieldRepo);
  });

  describe('execute', () => {
    it('should create a schema with fingerprint rules and field definitions', async () => {
      schemaRepo.findByNccTaxId.mockResolvedValue(null);

      const result = await sut.execute({
        name: 'Digiworld',
        nccName: 'Digiworld Corp',
        nccTaxId: '0302861742',
        description: 'Test schema',
        fingerprintRules: [
          { ruleType: 'mst_exact', pattern: '0302861742', priority: 1 },
          { ruleType: 'keyword', pattern: 'DIGIWORLD', priority: 2 },
        ],
        fieldDefinitions: [
          { fieldName: 'invoiceNumber', displayName: 'Số HĐ', dataType: 'string', isRequired: true },
          { fieldName: 'total', displayName: 'Tổng tiền', dataType: 'number', isRequired: true },
        ],
      });

      expect(result.status).toBe('draft');
      expect(result.name).toBe('Digiworld');
      expect(result.rulesCreated).toBe(2);
      expect(result.fieldsCreated).toBe(2);
      expect(schemaRepo.save).toHaveBeenCalledTimes(1);
      expect(ruleRepo.save).toHaveBeenCalledTimes(2);
      expect(fieldRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should create a schema without optional rules and fields', async () => {
      schemaRepo.findByNccTaxId.mockResolvedValue(null);

      const result = await sut.execute({
        name: 'Simple Schema',
        nccName: 'Simple Corp',
        nccTaxId: '0312345678',
      });

      expect(result.status).toBe('draft');
      expect(result.rulesCreated).toBe(0);
      expect(result.fieldsCreated).toBe(0);
      expect(schemaRepo.save).toHaveBeenCalledTimes(1);
      expect(ruleRepo.save).not.toHaveBeenCalled();
      expect(fieldRepo.save).not.toHaveBeenCalled();
    });

    it('should throw when a schema with the same NCC tax ID already exists', async () => {
      const existing = Schema.create({
        name: 'Existing',
        nccName: 'Existing Corp',
        nccTaxId: '0302861742',
      });
      schemaRepo.findByNccTaxId.mockResolvedValue(existing);

      await expect(
        sut.execute({
          name: 'Duplicate',
          nccName: 'Dup Corp',
          nccTaxId: '0302861742',
        }),
      ).rejects.toThrow(/already exists for NCC tax ID/);
    });

    it('should throw when NCC tax ID format is invalid', async () => {
      await expect(
        sut.execute({
          name: 'Bad Tax',
          nccName: 'Bad Corp',
          nccTaxId: '12345',
        }),
      ).rejects.toThrow(/Invalid tax ID format/);
    });

    it('should create with empty arrays for rules and fields', async () => {
      schemaRepo.findByNccTaxId.mockResolvedValue(null);

      const result = await sut.execute({
        name: 'Empty Arrays',
        nccName: 'Empty Corp',
        nccTaxId: '0312345678',
        fingerprintRules: [],
        fieldDefinitions: [],
      });

      expect(result.rulesCreated).toBe(0);
      expect(result.fieldsCreated).toBe(0);
    });
  });
});
